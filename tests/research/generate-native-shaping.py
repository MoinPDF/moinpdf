import ctypes as c, hashlib, json
from pathlib import Path
root=Path.cwd()
h=c.CDLL('/lib/x86_64-linux-gnu/libharfbuzz.so.0')
void=c.c_void_p; ui=c.c_uint; integer=c.c_int
class Info(c.Structure): _fields_=[('gid',ui),('mask',ui),('cluster',ui),('var1',ui),('var2',ui)]
class Pos(c.Structure): _fields_=[('xAdvance',integer),('yAdvance',integer),('xOffset',integer),('yOffset',integer),('var',ui)]
def sig(n,args,ret):
 f=getattr(h,n);f.argtypes=args;f.restype=ret;return f
sig('hb_version_string',[],c.c_char_p)
sig('hb_blob_create',[void,ui,integer,void,void],void)
sig('hb_face_create',[void,ui],void)
sig('hb_face_get_upem',[void],ui)
sig('hb_font_create',[void],void)
sig('hb_ot_font_set_funcs',[void],None)
sig('hb_font_set_scale',[void,integer,integer],None)
sig('hb_buffer_create',[],void)
sig('hb_buffer_add_utf16',[void,c.POINTER(c.c_uint16),integer,ui,integer],None)
sig('hb_buffer_set_direction',[void,integer],None)
sig('hb_script_from_string',[c.c_char_p,integer],ui)
sig('hb_buffer_set_script',[void,ui],None)
sig('hb_buffer_set_cluster_level',[void,integer],None)
sig('hb_buffer_guess_segment_properties',[void],None)
sig('hb_shape',[void,void,void,ui],None)
sig('hb_buffer_get_glyph_infos',[void,c.POINTER(ui)],c.POINTER(Info))
sig('hb_buffer_get_glyph_positions',[void,c.POINTER(ui)],c.POINTER(Pos))
for obj in ['buffer','font','face','blob']:sig('hb_'+obj+'_destroy',[void],None)
cases=[('Devanagari','Deva','किताब क्षत्रिय कर्म'),('Bengali','Beng','বাংলা শিক্ষা ক্ষতি'),('Gujarati','Gujr','ગુજરાતી શિક્ષણ'),('Gurmukhi','Guru','ਪੰਜਾਬੀ ਭਾਸ਼ਾ'),('Kannada','Knda','ಕನ್ನಡ ಭಾಷೆ'),('Malayalam','Mlym','മലയാളം ഭാഷ'),('Oriya','Orya','ଓଡ଼ିଆ ଭାଷା'),('Tamil','Taml','தமிழ் கொக்கு'),('Telugu','Telu','తెలుగు భాష'),('Thai','Thai','ภาษาไทย น้ำ กำ'),('Lao','Laoo','ພາສາລາວ ນ້ຳ'),('Khmer','Khmr','ភាសាខ្មែរ'),('Myanmar','Mymr','မြန်မာဘာသာ'),('Sinhala','Sinh','සිංහල භාෂාව'),('Devanagari','Deva','क्\u200dष क्\u200cष'),('Bengali','Beng','কৌ কো কৈ'),('Tamil','Taml','கொ கோ கௌ'),('Myanmar','Mymr','ကျောင်း မြန်မာ'),('Khmer','Khmr','កុំ កិ ក្រៀម')]
result={'harfbuzzVersion':h.hb_version_string().decode(),'library':'/lib/x86_64-linux-gnu/libharfbuzz.so.0','fontRepository':'notofonts/noto-fonts','fontCommit':'ffebf8c1ee449e544955a7e813c54f9b73848eac','clusterLevel':0,'direction':'ltr','cases':[]}
for script,tag,text in cases:
 path='public/vendor/editor-fonts/NotoSans'+script+'-Regular.ttf';data=(root/path).read_bytes();storage=c.create_string_buffer(data)
 blob=h.hb_blob_create(storage,len(data),0,None,None);face=h.hb_face_create(blob,0);upem=h.hb_face_get_upem(face);font=h.hb_font_create(face);h.hb_ot_font_set_funcs(font);h.hb_font_set_scale(font,upem,upem);buffer=h.hb_buffer_create()
 encoded=text.encode('utf-16-le');code=(c.c_uint16*(len(encoded)//2)).from_buffer_copy(encoded);h.hb_buffer_add_utf16(buffer,code,len(code),0,len(code));h.hb_buffer_set_direction(buffer,4);h.hb_buffer_set_script(buffer,h.hb_script_from_string(tag.encode(),4));h.hb_buffer_set_cluster_level(buffer,0);h.hb_buffer_guess_segment_properties(buffer);h.hb_shape(font,buffer,None,0)
 n=ui();info=h.hb_buffer_get_glyph_infos(buffer,c.byref(n));pos=h.hb_buffer_get_glyph_positions(buffer,c.byref(n))
 glyphs=[[info[i].gid,info[i].cluster,pos[i].xAdvance,pos[i].yAdvance,pos[i].xOffset,pos[i].yOffset] for i in range(n.value)]
 result['cases'].append({'script':script,'tag':tag,'text':text,'font':path,'fontSha256':hashlib.sha256(data).hexdigest(),'upem':upem,'glyphs':glyphs})
 for obj,pointer in [('buffer',buffer),('font',font),('face',face),('blob',blob)]:getattr(h,'hb_'+obj+'_destroy')(pointer)
(root/'tests/fixtures/native-shaping.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print('Native HarfBuzz '+result['harfbuzzVersion']+': wrote '+str(len(cases))+' cases with glyph IDs/clusters/advances/offsets and font SHA-256.')
