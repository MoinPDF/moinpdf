"""Conservative labels for detected form fields, in unrotated PDF coordinates."""
from __future__ import annotations
import csv
import io
import re
import shutil
import subprocess
import unicodedata
import pymupdf as fitz

LABELS = {
    'Vorname': ('vorname', 'first name', 'given name'),
    'Nachname': ('nachname', 'familienname', 'surname', 'last name'),
    'Vollständiger Name': ('vollstandiger name', 'vor und nachname', 'full name'),
    'Straße und Hausnummer': ('strasse und hausnummer', 'strasse hausnummer', 'street address', 'address line 1'),
    'Postleitzahl': ('postleitzahl', 'plz', 'postal code', 'postcode', 'zip code'),
    'Ort': ('ort', 'wohnort', 'stadt', 'city', 'town'),
    'Geburtsdatum': ('geburtsdatum', 'date of birth', 'birth date'),
    'E-Mail': ('e mail', 'email', 'e mail adresse', 'email address'),
    'Telefon': ('telefon', 'telefonnummer', 'phone', 'phone number', 'telephone'),
}

def normalise(text):
    text=''.join(c for c in unicodedata.normalize('NFKD', text.casefold()) if not unicodedata.combining(c)).replace('ß','ss')
    return re.sub(r'[^a-z0-9]+',' ',text).strip()

def page_words(page, directory):
    words=[(fitz.Rect(w[:4]), str(w[4]), 100.0) for w in page.get_text('words')]
    scanned = any(rect.get_area() > page.mediabox.get_area() * .3
        for image in page.get_images() for rect in page.get_image_rects(image[0]))
    if (words and not scanned) or not shutil.which('tesseract'):
        return words, 'text' if words else 'unavailable'
    # OCR reads a disposable image; the PDF's visible content is never rebuilt.
    image=directory/'form-labels.png'
    rotation=page.rotation
    try:
        page.set_rotation(0)
        pix=page.get_pixmap(dpi=160, colorspace=fitz.csGRAY, alpha=False)
    finally:
        page.set_rotation(rotation)
    pix.save(image)
    try:
        found=subprocess.run(['tesseract',str(image),'stdout','-l','deu+eng','--psm','11','-c','tessedit_create_tsv=1'],capture_output=True,text=True,timeout=20)
        if found.returncode != 0:return words, 'unavailable'
        for row in csv.DictReader(io.StringIO(found.stdout), delimiter='\t'):
            if row.get('level')!='5' or not row.get('text','').strip():continue
            try:
                x,y,w,h=(float(row[k]) for k in ('left','top','width','height'))
                confidence=float(row['conf'])
                rectangle=fitz.Rect(x,y,x+w,y+h)*fitz.Matrix(72/160,72/160)
                if w>0 and h>0 and not any((rectangle & old[0]).get_area()>rectangle.get_area()*.6 for old in words):
                    words.append((rectangle,row['text'].strip(),confidence))
            except (ValueError,KeyError):continue
        return words, 'ocr'
    except subprocess.TimeoutExpired:
        return words, 'unavailable'
    finally:
        image.unlink(missing_ok=True)

def label_candidates(words):
    lines=[]
    for rectangle,text,confidence in sorted(words,key=lambda w:(round(w[0].y0/3),w[0].x0)):
        if confidence<80:continue
        line=next((line for line in reversed(lines[-5:]) if abs(line[0][0].y0-rectangle.y0)<max(3,min(line[0][0].height,rectangle.height)*.5)),None)
        if line is None:line=[];lines.append(line)
        line.append((rectangle,text,confidence))
    result=[]
    for line in lines:
        groups=[]
        for word in sorted(line,key=lambda w:w[0].x0):
            if groups and word[0].x0-groups[-1][-1][0].x1<max(12,word[0].height*1.5):groups[-1].append(word)
            else:groups.append([word])
        for group in groups:
            text=' '.join(w[1] for w in group).strip(' :*')
            canonical=next((label for label, aliases in LABELS.items() if normalise(text) in aliases),None)
            if canonical:
                rectangle=fitz.Rect(group[0][0])
                for word in group[1:]:rectangle|=word[0]
                result.append((rectangle, canonical, text))
    return result

def assign_labels(rectangles, words):
    labels=label_candidates(words)
    scored=[]
    for rect in rectangles:
        matches=[]
        for index,(label,canonical,original) in enumerate(labels):
            left=rect.x0-label.x1
            vertical=abs((rect.y0+rect.y1-label.y0-label.y1)/2)
            above=rect.y0-label.y1
            if -2<=left<=100 and vertical<=max(10,rect.height*.6):
                matches.append((max(0,left)+vertical*2,index))
            elif -2<=above<=28 and abs(rect.x0-label.x0)<max(15,rect.width*.15):
                matches.append((max(0,above)+abs(rect.x0-label.x0)+5,index))
        matches.sort()
        scored.append(matches)
    result=[]
    for field,matches in enumerate(scored):
        if not matches or (len(matches)>1 and matches[1][0]-matches[0][0]<8):result.append(None);continue
        score,index=matches[0]
        if any(other!=field and choices and choices[0][1]==index and choices[0][0]<=score+8 for other,choices in enumerate(scored)):
            result.append(None);continue
        result.append({'name':labels[index][1],'label':labels[index][2]})
    return result
