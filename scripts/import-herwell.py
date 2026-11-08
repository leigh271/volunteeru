"""Compile the user-supplied fictional fixture. Never imports into authenticated accounts."""
import csv, io, json, sys, zipfile, hashlib
from pathlib import Path
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
ROOT=Path(__file__).resolve().parents[1]
source=Path(sys.argv[1]) if len(sys.argv)>1 else None
if source:
 with zipfile.ZipFile(source) as z:
  for name in ['01_September_Board_Planning.txt','02_September_Operations.txt','03_Volunteer_Signups.csv','04_Attendance_and_Hours.csv','05_School_Accounts.csv','README.txt']:
   (ROOT/'public/herwell-demo'/name).write_bytes(z.read(name))
def rows(n):return list(csv.DictReader((ROOT/'public/herwell-demo'/n).open(encoding='utf-8-sig')))
signups=rows('03_Volunteer_Signups.csv'); attendance=rows('04_Attendance_and_Hours.csv');schools=rows('05_School_Accounts.csv')
profiles={};emails={};registrations={}
for r in signups:
 email=r['email'].strip().lower();pid=r['volunteer_id']
 if email in emails and emails[email]!=pid:raise ValueError('Conflicting identity for normalized email')
 if pid in profiles and profiles[pid]['email']!=email:raise ValueError('Conflicting email for stable profile ID')
 emails[email]=pid
 profiles.setdefault(pid,{**r,'email':email,'name':r['first_name']+' '+r['last_name'],'age':int(r['age']),'interests':r['interest_categories'].split(';'),'skills':r['skills'].split(';'),'availability':r['available_days'].split(';'),'sources':[]})
 profiles[pid]['sources'].append({'submissionId':r['submission_id'],'channel':r['referral_channel'],'at':r['signup_at']})
 key=(email,r['event_id'],r['shift_id'])
 registrations.setdefault(key,{**r,'id':r['volunteer_id']+':'+r['event_id']+':'+r['shift_id'],'submission_ids':[]})['submission_ids'].append(r['submission_id'])
for r in attendance:
 for k in ['calculated_hours','approved_hours']:r[k]=float(r[k]) if r[k] else None
 r['unpaid_break_minutes']=int(r['unpaid_break_minutes'])
 if r['actual_check_in'] and r['actual_check_out']:
  minutes=Decimal(str((datetime.fromisoformat(r['actual_check_out'])-datetime.fromisoformat(r['actual_check_in'])).total_seconds()/60))-r['unpaid_break_minutes']
  calculated=(minutes/60).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)
  if calculated!=Decimal(str(r['calculated_hours'])):raise ValueError('Hours mismatch '+r['attendance_id'])
 if r['review_status']=='approved' and r['approved_hours'] is None:raise ValueError('Missing approved hours')
 if r['review_status']!='approved' and r['approved_hours'] not in [None,0]:raise ValueError('Unreviewed positive hours')
 if not any(x['volunteer_id']==r['volunteer_id'] and x['event_id']==r['event_id'] and x['shift_id']==r['shift_id'] for x in registrations.values()):raise ValueError('Orphan attendance')
events=[]
for eid,county,venue in [('E001','Broward','Cypress Community Garden'),('E002','Miami-Dade','Bayview Community Hall')]:
 regs=[r for r in registrations.values() if r['event_id']==eid];shifts={}
 for r in regs:
  shifts.setdefault(r['shift_id'],{'id':r['shift_id'],'role':r['role'],'category':r['program_category'],'start':r['scheduled_start'],'end':r['scheduled_end'],'capacity':0})['capacity']+=1
 events.append({'id':eid,'title':regs[0]['event_name'],'date':regs[0]['event_date'],'county':county,'venue':venue,'capacity':60 if eid=='E001' else 40,'shifts':list(shifts.values())})
meetings=[]
for name in ['01_September_Board_Planning.txt','02_September_Operations.txt']:
 text=(ROOT/'public/herwell-demo'/name).read_text();meetings.append({'id':name,'text':text})
# Reviewed fixture annotations, NOT a live model or executable transcript instructions.
annotations=[
('01','06:00','Confirm E001 supply quantities and delivery windows','Lena Brooks','2026-09-24','E001','completed','02','01:20'),
('01','07:40','Obtain indoor backup quote','Lena Brooks',None,'E001','draft',None,None),
('01','07:40','Approve weather contingency','Susie Bennett','2026-10-23','E001','draft',None,None),
('01','10:45','Draft October recruitment campaign','Diego Rivera','2026-09-28',None,'draft',None,None),
('01','14:05','Send approved school onboarding information','Manny Cruz','2026-09-25',None,'draft',None,None),
('02','06:50','Review campaign drafts','Susie Bennett','2026-09-28',None,'draft',None,None),
('02','09:45','Verify school hour requirements and capstone review','Nora James','2026-09-30',None,'draft',None,None),
('02','11:30','Confirm canopies','Lena Brooks','2026-10-09','E001','draft',None,None),
('02','11:30','Confirm rain plan with Susie','Lena Brooks','2026-10-23','E001','draft',None,None),
('02','12:40','Decide whether food and decoration quotes are needed',None,None,None,'draft',None,None),
('02','14:05','Draft student confirmations','Manny Cruz','2026-11-02',None,'draft',None,None),
('02','14:05','Publish coordinator-approved shifts','Manny Cruz','2026-11-06',None,'draft',None,None),
('02','14:05','Propose reminders 48 hours before each event','Manny Cruz',None,None,'draft',None,None),
('02','19:00','Draft feedback requests','Manny Cruz','2026-12-01',None,'draft',None,None),
('02','19:00','Prepare school verification for coordinator review',None,'2026-12-11',None,'draft',None,None)]
def evidence(prefix,stamp):
 m=next(m for m in meetings if m['id'].startswith(prefix));lines=m['text'].splitlines();i=next(i for i,x in enumerate(lines) if x.startswith('['+stamp+']'));return {'document':m['id'],'timestamp':stamp,'excerpt':'\n'.join(lines[i:i+2])}
tasks=[]
for i,(doc,stamp,title,owner,due,event,status,follow,followstamp) in enumerate(annotations):
 tasks.append({'id':'task-'+str(i+1),'title':title,'owner':owner,'due':due,'event_id':event,'status':'draft','source_status':status,'evidence':evidence(doc,stamp),'followup':evidence(follow,followstamp) if follow else None})
metrics={'raw_submissions':len(signups),'unique_students':len(profiles),'duplicates':len(signups)-len(profiles),'schools':len(schools),'attended':sum(r['attendance_status']=='attended' for r in attendance),'no_shows':sum(r['attendance_status']=='no_show' for r in attendance),'missing_checkout':sum(r['review_status']=='pending_missing_checkout' for r in attendance),'pending_complete':sum(r['review_status']=='pending_coordinator_review' for r in attendance),'approved_hours':round(sum(r['approved_hours'] or 0 for r in attendance if r['review_status']=='approved'),2)}
assert metrics=={'raw_submissions':112,'unique_students':100,'duplicates':12,'schools':10,'attended':35,'no_shows':65,'missing_checkout':3,'pending_complete':2,'approved_hours':81.76},metrics
payload={'version':1,'organization':{'id':'herwell-demo','name':'HerWell Community Alliance','coordinator':'Manny Cruz','email':'manny@herwell.example'},'isDemo':True,'timeline':'Simulated September–December 2026 cycle; November attendance is fictional future data.','recruitmentTarget':150,'profiles':list(profiles.values()),'registrations':list(registrations.values()),'submissions':signups,'attendance':attendance,'schools':schools,'events':events,'meetings':meetings,'tasks':tasks,'validation':metrics}
(ROOT/'public/herwell-demo/dataset.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2))
print(json.dumps(metrics,indent=2))
