import json
B, Mk = 'bryn@sonor.co.uk', 'mark@sonor.co.uk'
def n(i, kind, ch, st, text, fc, room, key, label, nn, stage, by, at, review=None, linked=None, x=None, y=None, tx=None, ty=None):
    return dict(id='de300000-0000-4000-8000-0000005e%04d' % i, kind=kind, change_type=ch, status=st, text=text, floor_code=fc, room=room, device_key=key, device_label=label,
                service_nn=nn, stage=stage, created_by=by, created_at=at, review=review, linked=linked or {}, x=x, y=y, to_x=tx, to_y=ty)
R = lambda act, note=None: dict(by=B, at='2026-11-10T16:55:03Z', action=act, note=note)
notes = [
 n(18,'note',None,'open','Controller on the network at .10, Composer project loaded, OS updated.','GF','Garage','MN-GF-GAR','Control processor',7,'commissioning',B,'2026-11-10T15:20:00Z'),
 n(15,'snag',None,'promoted','Access point not powering up — suspect PoE port 7 on the laundry switch.','1F','Bed 2','WAP-1F-BED2','Ceiling-mount access point',9,'commissioning',B,'2026-11-10T14:45:00Z',R('snag'),{'task_id':'472aff29'}),
 n(13,'question',None,'open','Client asked for a third data point by the window desk — needs pricing before we chase it in.','1F','Office','DPT-1F-OFF','Data Point Twin',9,'second_fix',B,'2026-11-10T14:10:00Z'),
 n(8,'snag',None,'open','Shaver socket fitted on the wrong wall — electrician to swap it with the light switch position.','1F','Bed 5 Ensuite','SH-1F-B5EN','Shaver socket',None,'second_fix',Mk,'2026-11-10T13:40:00Z'),
 n(7,'snag',None,'promoted','Doorbell back box is crooked by about 5° — re-fix before the render goes on.','GF','Porch','DB-GF-PRCH','Video doorbell',8,'second_fix',B,'2026-11-10T13:05:00Z',R('snag'),{'task_id':'2cf735b3'}),
 n(6,'snag',None,'promoted','Back-right surround back box sits 120 mm lower than the left — re-cut and plasterer to make good.','GF','Sitting Room (cinema)','SURBR-GF-SITT','Surround speaker, back right',1,'second_fix',Mk,'2026-11-10T12:30:00Z',R('snag'),{'task_id':'7c0bf148'}),
 n(11,'change','route','open','HDMI and Cat6 run through the void under the stairs, not the ceiling — joist notching not allowed there.','GF','Lounge','TV4K-GF-LNG','TV point — 4K',3,'second_fix',Mk,'2026-11-10T11:55:00Z'),
 n(4,'question',None,'promoted','Landing ceiling is a lath and plaster coffer — OK to surface-mount the AP, or move it into the airing cupboard?','1F','Landing','WAP-1F-LAND','Ceiling-mount access point',9,'second_fix',Mk,'2026-11-10T11:12:00Z',R('rfi'),{'rfi_id':'RFI-008'}),
 n(9,'change','omitted','open','Left out — the bifold has an integral contact; wired back to the alarm panel instead.','GF','Dining Area','DC-GF-DIN','Door contact',8,'second_fix',Mk,'2026-11-10T10:48:00Z'),
 n(10,'change','added','open','Added a data point behind the fridge housing for the Sub-Zero Wi-Fi module.','GF','Kitchen',None,None,9,'second_fix',B,'2026-11-10T10:20:00Z',x=545,y=445),
 n(2,'change','swapped','accepted','Client has gone to an 85" set — tilt mount instead of fixed, back box raised 150 mm.','GF','Living Area','FXWL-GF-LIV','Fixed TV mount',3,'second_fix',B,'2026-11-10T10:05:00Z',R('accept','Draw the tilt mount + raised box on the as-built')),
 n(1,'change','moved','open','Speaker moved 400 mm towards the island to clear the new pendant drop over the worktop.','GF','Kitchen','CSM-GF-KIT-03','Ceiling speaker',2,'second_fix',Mk,'2026-11-10T09:42:00Z',tx=515,ty=468),
 n(17,'photo',None,'open','Speaker cut-outs marked against the joist layout before the boarders close up.','1F','Master Bed','CSM-1F-MBED-02','Ceiling speaker',2,'second_fix',Mk,'2026-11-10T09:05:00Z'),
 n(16,'note',None,'open','Skip at the side gate — keep the path clear for the rack delivery on Thursday.','GF',None,None,None,None,None,B,'2026-11-10T08:50:00Z',x=480,y=805),
 n(12,'note',None,'resolved','Second fix done: plates fitted and labelled, both ports tested to the laundry switch.','1F','Master Bed','DPT-1F-MBED','Data Point Twin',9,'second_fix',B,'2026-11-09T15:30:00Z',R('resolve')),
 n(3,'change','moved','applied',"Touchscreen moved to the right of the front door — the joiner's coat cupboard now sits on the left.",'GF','Entrance Hall','T4IW8-GF-HALL','C4 T4 in-wall 8"',7,'second_fix',Mk,'2026-11-09T14:20:00Z',R('applied','Moved on the Takeoffs as-built'),tx=378,ty=618),
 n(14,'snag',None,'dismissed','TV point looks low for the rowing machine.','GF','Gym','TV4K-GF-GYM','TV point — 4K',3,'second_fix',Mk,'2026-11-09T11:00:00Z',R('dismiss','Checked — 1,200 mm to centre, matches the drawing')),
 n(5,'note',None,'resolved','Rack in, levelled and bolted to the floor. Earth bond done by DT Electrical.','GF','Garage','RA-GF-GAR','18U comms rack',10,'rack_build',B,'2026-11-09T09:15:00Z',R('resolve')),
]
CL = lambda s: s in ('done','cancelled','closed','resolved','verified')
def sn(i, src, title, st, pr, who, nn, at): return dict(id=i, source=src, title=title, status=st, open=not CL(st), priority=pr, assignee=who, service_nn=nn, floor=None, created_at=at)
snags = [
 sn('7c0bf148','tasks','GF Sitting Room (cinema) · Back-right surround back box sits 120 mm lower than the left — re-cut and plaste','todo','p2',Mk,1,'2026-11-10T16:55:03Z'),
 sn('2cf735b3','tasks','GF Porch · Doorbell back box is crooked by about 5° — re-fix before the render goes on.','todo','p2',Mk,8,'2026-11-10T16:55:03Z'),
 sn('472aff29','tasks','1F Bed 2 · Access point not powering up — suspect PoE port 7 on the laundry switch.','todo','p2',B,9,'2026-11-10T16:55:03Z'),
 sn('51a1','portal','Cinema LED cove flickers at low dim level','assigned','p1',Mk,4,'2026-10-28T19:40:00Z'),
 sn('51a2','portal','Kitchen ceiling speaker grille not flush','raised','p2','dan@dtelectrical-nw.co.uk',2,'2026-10-30T11:05:00Z'),
 sn('51a3','portal','Garage rack: patch panel labels missing ports 17–24','resolved','p3','phil@sonor.co.uk',9,'2026-10-25T09:00:00Z'),
 sn('51a4','portal','Front door camera night image washed out','assigned','p2',Mk,8,'2026-10-29T21:10:00Z'),
 sn('51a5','portal','Master Bed blind stops 50mm short of sill','raised','p2',Mk,5,'2026-10-31T10:20:00Z'),
 sn('51a6','portal','Gym TV bracket — cable cover not fitted','closed','p3','dan@dtelectrical-nw.co.uk',3,'2026-10-22T14:00:00Z'),
]
def rf(id_, to, text, fl, st, at): return dict(id=id_, rfi_id=id_, to=to, text=text, floor=fl, status=st, open=st not in ('closed','answered','resolved','done'), created_at=at)
rfis = [rf('RFI-001','Architect','Confirm ceiling void depth in the cinema for Atmos speakers and the RGBW cove (need ≥ 150 mm).','GF','done','2026-09-04T10:00:00Z'),
 rf('RFI-002','Contractor','Plant room: confirm 2 no. dedicated 16 A radials and ventilation for the head-end rack.','GF','done','2026-09-04T10:05:00Z'),
 rf('RFI-003','Client','Office TV: confirm final wall (east or west) before 2nd fix.','1F','open','2026-10-27T09:30:00Z'),
 rf('RFI-004','Electrician','Garage consumer unit: confirm 2 no. spare ways for the head-end commando radials (EL-03 / EL-04) and the lighting panel MCBs (EL-12 / EL-13) before 2nd fix.','GF','open','2026-11-03T09:10:00Z'),
 rf('RFI-005','Electrician','LED head end HE1 (plant room): 2 no. unswitched 10 A type C radials (C1 / C2) — confirm RCBO type (Type A) and the route along cable tray CT-GF-001.','GF','open','2026-11-04T14:20:00Z'),
 rf('RFI-006','Architect','Ensuites: confirm shaver sockets sit outside zone 2 and the towel-rail spur positions in all four ensuites.','1F','open','2026-11-02T11:00:00Z'),
 rf('RFI-007','Contractor','Kitchen: appliance schedule for the spur positions (oven, fridge-freezer, hood) and hob isolator height — answered by Brookmere 20 Oct, positions as drawn.','GF','done','2026-10-14T10:30:00Z'),
 rf('RFI-008','Sonor','Landing ceiling is a lath and plaster coffer — OK to surface-mount the AP, or move it into the airing cupboard?','1F','open','2026-11-10T16:55:03Z')]
stages = [dict(key=k, label=l) for k, l in [('first_fix','1st fix'),('rack_build','Rack & panel build'),('second_fix','2nd fix'),('site_install','Site install'),('commissioning','Test & commission'),('programming','Programming'),('handover','Snag & handover')]]
json.dump(dict(project=dict(name='Sonor Demo Project', ref='DEMO - Sonor Demo Project', client_name='Oliver & Clara Wrenfield'), notes=notes, snags=snags, rfis=rfis, stages=stages, floors=[]), open('rest.json','w'))
