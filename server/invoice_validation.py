"""Reference-only report extraction, verified against pinned KoSIT reports."""

import base64
from collections import Counter
import hashlib
import json
from pathlib import Path
import sys

from defusedxml import ElementTree as ET

NS = {
    "rep": "http://www.xoev.de/de/validator/varl/1",
    "s": "http://www.xoev.de/de/validator/framework/1/scenarios",
    "rsm": "urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100",
    "ram": "urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100",
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
}
BASE_PROFILE = "urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0"
XR_PROFILES = {
    BASE_PROFILE: "XRechnung",
    BASE_PROFILE + "#conformant#urn:xeinkauf.de:kosit:extension:xrechnung_3.0": "XRechnung Extension",
    BASE_PROFILE + "#compliant#urn:xeinkauf.de:kosit:xrechnung:cvd_0.9": "XRechnung CVD",
}


def boolean(raw):
    if raw not in {"true", "false", "1", "0"}:
        raise ValueError("Missing or invalid report boolean")
    return raw in {"true", "1"}


def profile(source):
    try:
        document = ET.fromstring(source, forbid_dtd=True, forbid_entities=True, forbid_external=True)
    except Exception:
        return "unparseable", None, None
    if document.tag == "{" + NS["rsm"] + "}CrossIndustryInvoice":
        paths = ("rsm:ExchangedDocumentContext/ram:GuidelineSpecifiedDocumentContextParameter/ram:ID", "rsm:ExchangedDocumentContext/ram:BusinessProcessSpecifiedDocumentContextParameter/ram:ID")
        syntax = "CII"
    elif document.tag in {"{urn:oasis:names:specification:ubl:schema:xsd:Invoice-2}Invoice", "{urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2}CreditNote"}:
        paths = ("cbc:CustomizationID", "cbc:ProfileID")
        syntax = "UBL Invoice" if document.tag.endswith("}Invoice") else "UBL CreditNote"
    else:
        return "unknown", None, None
    values = []
    for path in paths:
        matches = document.findall(path, NS)
        values.append(matches[0].text if len(matches) == 1 else None)
    return syntax, *values


def summarize(report_bytes, source_bytes, exit_code=None):
    report = ET.fromstring(report_bytes, forbid_dtd=True, forbid_entities=True, forbid_external=True)
    if report.tag != "{" + NS["rep"] + "}report" or report.get("varlVersion") != "1.0.0":
        raise ValueError("Unexpected KoSIT report root or version")
    assessments = report.findall("rep:assessment", NS)
    if len(assessments) != 1:
        raise ValueError("Expected one assessment")
    accepted_nodes = assessments[0].findall("rep:accept", NS)
    rejected_nodes = assessments[0].findall("rep:reject", NS)
    if len(accepted_nodes) + len(rejected_nodes) != 1:
        raise ValueError("Missing or contradictory KoSIT assessment")
    accepted = bool(accepted_nodes)
    if exit_code is not None and (exit_code not in (0, 1) or (exit_code == 0) != accepted):
        raise ValueError("KoSIT exit code and assessment disagree")
    matched = report.findall("rep:scenarioMatched", NS)
    if len(matched) > 1:
        raise ValueError("Ambiguous scenario")
    scenario = matched[0].find("s:scenario", NS) if matched else None
    scenario_name = scenario.findtext("s:name", namespaces=NS) if scenario is not None else None
    if accepted and (scenario is None or not scenario_name):
        raise ValueError("Accepted document without matched scenario")
    overrides = {}
    if scenario is not None:
        for item in scenario.findall("s:createReport/s:customLevel", NS):
            level = item.get("level")
            if level not in {"error", "warning", "information"}:
                raise ValueError("Unknown custom severity")
            for code in (item.text or "").split():
                if code in overrides and overrides[code] != level:
                    raise ValueError("Conflicting custom severities")
                overrides[code] = level
    messages = []
    steps = []
    # Exact namespace avoids matching similarly named embedded XHTML elements.
    for step in report.findall(".//rep:validationStepResult", NS):
        steps.append({"id": step.get("id"), "valid": boolean(step.get("valid")), "name": step.findtext("s:resource/s:name", namespaces=NS), "resource": step.findtext("s:resource/s:location", namespaces=NS)})
        for item in step.findall("rep:message", NS):
            code = item.get("code")
            level = item.get("level")
            if level not in {"error", "warning", "information"}:
                raise ValueError("Unknown message severity")
            effective = overrides.get(code, level) if code != "PROCESSING_ERROR" else level
            messages.append({"code": code, "level": level, "effectiveLevel": effective, "text": " ".join("".join(item.itertext()).split()), "location": item.get("xpathLocation"), "line": item.get("lineNumber"), "column": item.get("columnNumber"), "step": step.get("id")})
    counts = Counter(message["effectiveLevel"] for message in messages)
    digest_algorithm = report.findtext("rep:documentIdentification/rep:documentHash/rep:hashAlgorithm", namespaces=NS)
    digest_value = report.findtext("rep:documentIdentification/rep:documentHash/rep:hashValue", namespaces=NS)
    digest_matches = digest_algorithm == "SHA-256" and digest_value is not None and base64.b64decode(digest_value, validate=True) == hashlib.sha256(source_bytes).digest()
    if not digest_matches:
        raise ValueError("Report does not identify the supplied document hash")
    syntax, identifier, business_process = profile(source_bytes)
    kind = XR_PROFILES.get(identifier)
    expected_name = f"EN16931 {kind} ({syntax})" if kind else None
    is_xrechnung_scenario = expected_name is not None and scenario_name == expected_name
    return {
        "engine": report.findtext("rep:engine/rep:name", namespaces=NS),
        "timestamp": report.findtext("rep:timestamp", namespaces=NS),
        "accepted": accepted,
        "reportValid": boolean(report.get("valid")),
        "scenarioMatched": bool(matched),
        "scenarioName": scenario_name,
        "syntax": syntax,
        "profileId": identifier,
        "businessProcessId": business_process,
        "isXRechnungScenario": is_xrechnung_scenario,
        "xrechnungAccepted": accepted and is_xrechnung_scenario,
        "errorCount": counts["error"],
        "warningCount": counts["warning"],
        "informationCount": counts["information"],
        "messages": messages,
        "steps": steps,
        "documentHashVerified": digest_matches,
    }


if __name__ == "__main__":
    report, source = map(Path, sys.argv[1:3])
    print(json.dumps(summarize(report.read_bytes(), source.read_bytes()), ensure_ascii=False, indent=2))
