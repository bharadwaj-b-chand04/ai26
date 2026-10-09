"""Evaluate explicit labeled JSONL records. Synthetic fixtures never establish model accuracy."""
import argparse
import json
from pathlib import Path


def iou(a,b):
    area=lambda box:max(0,box[2]-box[0])*max(0,box[3]-box[1])
    intersection=area([max(a[0],b[0]),max(a[1],b[1]),min(a[2],b[2]),min(a[3],b[3])])
    union=area(a)+area(b)-intersection
    return intersection/union if union else 0


def evaluate(records):
    seen=set();plate_total=plate_correct=plate_false=plate_unread=0
    tp=fp=fn=0;switches=0;identities={}
    link_tp=link_fp=link_fn=0;rule_tp=rule_fp=rule_fn=0
    passages_expected=passages_predicted=0
    for r in records:
        sample=r['sample_id']
        if sample in seen: raise ValueError(f'Duplicate sample ID: {sample}')
        seen.add(sample)
        if 'expected_plate' in r:
            plate_total+=1
            prediction=r.get('predicted_plate');expected=r['expected_plate']
            plate_correct+=prediction==expected
            plate_unread+=prediction is None
            plate_false+=prediction is not None and prediction!=expected
        ground=r.get('expected_boxes',[]);prediction=r.get('predicted_boxes',[])
        matches=[]
        for pi,p in enumerate(prediction):
            for gi,g in enumerate(ground):
                if p['label']==g['label']: matches.append((iou(p['bbox'],g['bbox']),pi,gi))
        used_p=set();used_g=set()
        for score,pi,gi in sorted(matches,reverse=True):
            if score<.5 or pi in used_p or gi in used_g: continue
            used_p.add(pi);used_g.add(gi);tp+=1
            g,p=ground[gi],prediction[pi]
            if 'identity' in g and 'track_id' in p:
                key=(r.get('camera'),r.get('session'),g['identity'])
                if key in identities and identities[key]!=p['track_id']:switches+=1
                identities[key]=p['track_id']
        fp+=len(prediction)-len(used_p);fn+=len(ground)-len(used_g)
        for prefix in ('link','rule'):
            expected=r.get('expected_'+prefix);predicted=r.get('predicted_'+prefix)
            if expected is None:continue
            if not isinstance(expected,bool) or not isinstance(predicted,bool):raise ValueError(f'{prefix} requires Boolean labels/predictions')
            if prefix=='link':
                link_tp+=expected and predicted;link_fp+=not expected and predicted;link_fn+=expected and not predicted
            else:
                rule_tp+=expected and predicted;rule_fp+=not expected and predicted;rule_fn+=expected and not predicted
        passages_expected+=r.get('expected_passages',0);passages_predicted+=r.get('predicted_passages',0)
    rate=lambda a,b:round(a/b,4) if b else None
    return {'sample_count':len(records),'synthetic':any(r.get('synthetic',False) for r in records),
            'detector':{'tp':tp,'fp':fp,'fn':fn,'precision':rate(tp,tp+fp),'recall':rate(tp,tp+fn),'iou_threshold':.5},
            'plates':{'labeled_samples':plate_total,'exact_matches':plate_correct,'exact_match_rate':rate(plate_correct,plate_total),'false_reads':plate_false,'abstentions':plate_unread},
            'tracking':{'matched_ground_truth_identities':len(identities),'id_switches':switches},
            'links':{'tp':link_tp,'fp':link_fp,'fn':link_fn,'precision':rate(link_tp,link_tp+link_fp),'recall':rate(link_tp,link_tp+link_fn)},
            'rules':{'tp':rule_tp,'fp':rule_fp,'fn':rule_fn,'precision':rate(rule_tp,rule_tp+rule_fp),'recall':rate(rule_tp,rule_tp+rule_fn)},
            'passages':{'expected':passages_expected,'predicted':passages_predicted,'signed_error':passages_predicted-passages_expected},
            'limitations':['Inputs must be labeled held-out predictions in source-time order. This runner does not supply labels or prove split independence. Synthetic records are correctness fixtures only.']}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--records',type=Path,required=True);parser.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();records=[json.loads(line) for line in args.records.read_text().splitlines() if line.strip()]
    result=evaluate(records);args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+'\n')
    print(f'{len(records)} records evaluated; synthetic={result["synthetic"]}; output={args.output}')
