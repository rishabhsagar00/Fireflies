// Demo organisation: 8 teams, their people, 9 past meetings and the commitments Fireflies found.
// Dates are written as of Thu 8 Oct 2026, 10:15 AM; seed.ts shifts them by whole weeks so they
// stay close to today and weekday words ("by Friday") still match.
import type { Team, Member } from "../../../shared/core.ts";

export const SEED_NOW = "2026-10-08T10:15";

export const TEAMS: Team[] = [
 {
  "id": "product",
  "name": "Product · SaaS",
  "channel": "slack",
  "tracker": "jira",
  "trackerKey": "PRD",
  "manager": "Rohan Mehta",
  "sort": 0
 },
 {
  "id": "payments",
  "name": "Payments · FinTech",
  "channel": "slack",
  "tracker": "jira",
  "trackerKey": "PAY",
  "manager": "Amit Verma",
  "sort": 1
 },
 {
  "id": "opd",
  "name": "OPD Operations · Hospital",
  "channel": "email",
  "tracker": "none",
  "trackerKey": "",
  "manager": "Dr. Ananya Rao",
  "sort": 2
 },
 {
  "id": "plant",
  "name": "Plant Ops · Manufacturing",
  "channel": "slack",
  "tracker": "jira",
  "trackerKey": "MFG",
  "manager": "Rajesh Kulkarni",
  "sort": 3
 },
 {
  "id": "growth",
  "name": "Growth · E-commerce",
  "channel": "slack",
  "tracker": "asana",
  "trackerKey": "",
  "manager": "Nisha Agarwal",
  "sort": 4
 },
 {
  "id": "sales",
  "name": "Sales · Real Estate",
  "channel": "teams",
  "tracker": "jira",
  "trackerKey": "RE",
  "manager": "Mohit Khanna",
  "sort": 5
 },
 {
  "id": "learning",
  "name": "Learning · EdTech",
  "channel": "email",
  "tracker": "none",
  "trackerKey": "",
  "manager": "Ishita Bose",
  "sort": 6
 },
 {
  "id": "delivery",
  "name": "Delivery Ops · Logistics",
  "channel": "teams",
  "tracker": "jira",
  "trackerKey": "LOG",
  "manager": "Rajeev Malhotra",
  "sort": 7
 }
];

export const MEMBERS: Member[] = [
 {
  "teamId": "product",
  "name": "Rohan Mehta",
  "email": "rohan.mehta@yourcompany.com",
  "sort": 0
 },
 {
  "teamId": "product",
  "name": "Priya Sharma",
  "email": "priya.sharma@yourcompany.com",
  "sort": 1
 },
 {
  "teamId": "product",
  "name": "Arjun Nair",
  "email": "arjun.nair@yourcompany.com",
  "sort": 2
 },
 {
  "teamId": "product",
  "name": "Neha Kapoor",
  "email": "neha.kapoor@yourcompany.com",
  "sort": 3
 },
 {
  "teamId": "product",
  "name": "James Carter",
  "email": "james.carter@yourcompany.com",
  "sort": 4
 },
 {
  "teamId": "payments",
  "name": "Amit Verma",
  "email": "amit.verma@yourcompany.com",
  "sort": 0
 },
 {
  "teamId": "payments",
  "name": "Sneha Iyer",
  "email": "sneha.iyer@yourcompany.com",
  "sort": 1
 },
 {
  "teamId": "payments",
  "name": "Kunal Bhatia",
  "email": "kunal.bhatia@yourcompany.com",
  "sort": 2
 },
 {
  "teamId": "payments",
  "name": "Pooja Menon",
  "email": "pooja.menon@yourcompany.com",
  "sort": 3
 },
 {
  "teamId": "opd",
  "name": "Dr. Ananya Rao",
  "email": "ananya.rao@yourcompany.com",
  "sort": 0
 },
 {
  "teamId": "opd",
  "name": "Vikram Singh",
  "email": "vikram.singh@yourcompany.com",
  "sort": 1
 },
 {
  "teamId": "opd",
  "name": "Rahul Desai",
  "email": "rahul.desai@yourcompany.com",
  "sort": 2
 },
 {
  "teamId": "opd",
  "name": "Meera Pillai",
  "email": "meera.pillai@yourcompany.com",
  "sort": 3
 },
 {
  "teamId": "plant",
  "name": "Rajesh Kulkarni",
  "email": "rajesh.kulkarni@yourcompany.com",
  "sort": 0
 },
 {
  "teamId": "plant",
  "name": "Manish Gupta",
  "email": "manish.gupta@yourcompany.com",
  "sort": 1
 },
 {
  "teamId": "plant",
  "name": "Deepak Yadav",
  "email": "deepak.yadav@yourcompany.com",
  "sort": 2
 },
 {
  "teamId": "plant",
  "name": "Kavita Joshi",
  "email": "kavita.joshi@yourcompany.com",
  "sort": 3
 },
 {
  "teamId": "plant",
  "name": "Suresh Patil",
  "email": "suresh.patil@yourcompany.com",
  "sort": 4
 },
 {
  "teamId": "growth",
  "name": "Nisha Agarwal",
  "email": "nisha.agarwal@yourcompany.com",
  "sort": 0
 },
 {
  "teamId": "growth",
  "name": "Simran Kaur",
  "email": "simran.kaur@yourcompany.com",
  "sort": 1
 },
 {
  "teamId": "growth",
  "name": "Varun Chopra",
  "email": "varun.chopra@yourcompany.com",
  "sort": 2
 },
 {
  "teamId": "growth",
  "name": "Aditya Rao",
  "email": "aditya.rao@yourcompany.com",
  "sort": 3
 },
 {
  "teamId": "growth",
  "name": "Emily Watson",
  "email": "emily.watson@yourcompany.com",
  "sort": 4
 },
 {
  "teamId": "sales",
  "name": "Mohit Khanna",
  "email": "mohit.khanna@yourcompany.com",
  "sort": 0
 },
 {
  "teamId": "sales",
  "name": "Pankaj Sethi",
  "email": "pankaj.sethi@yourcompany.com",
  "sort": 1
 },
 {
  "teamId": "sales",
  "name": "Shweta Arora",
  "email": "shweta.arora@yourcompany.com",
  "sort": 2
 },
 {
  "teamId": "sales",
  "name": "Abhishek Jain",
  "email": "abhishek.jain@yourcompany.com",
  "sort": 3
 },
 {
  "teamId": "learning",
  "name": "Ishita Bose",
  "email": "ishita.bose@yourcompany.com",
  "sort": 0
 },
 {
  "teamId": "learning",
  "name": "Karan Malhotra",
  "email": "karan.malhotra@yourcompany.com",
  "sort": 1
 },
 {
  "teamId": "learning",
  "name": "Ritu Sharma",
  "email": "ritu.sharma@yourcompany.com",
  "sort": 2
 },
 {
  "teamId": "delivery",
  "name": "Rajeev Malhotra",
  "email": "rajeev.malhotra@yourcompany.com",
  "sort": 0
 },
 {
  "teamId": "delivery",
  "name": "Farhan Qureshi",
  "email": "farhan.qureshi@yourcompany.com",
  "sort": 1
 },
 {
  "teamId": "delivery",
  "name": "Ankit Tiwari",
  "email": "ankit.tiwari@yourcompany.com",
  "sort": 2
 },
 {
  "teamId": "delivery",
  "name": "Divya Menon",
  "email": "divya.menon@yourcompany.com",
  "sort": 3
 }
];

export interface SeedMeeting { id: string; team: string; title: string; date: string; start: string; mins: number; overview: string[]; keywords: string[]; lines: [string, string, string][]; }
export const MEETINGS: SeedMeeting[] = [
 {
  "id": "m2",
  "team": "payments",
  "title": "Merchant Payment Failure Review",
  "date": "2026-10-07",
  "start": "11:00",
  "mins": 42,
  "overview": [
   "UPI payment failures rose to <b>4.8%</b> in the evening peak, mostly gateway timeouts on one acquiring bank.",
   "Team agreed to find the root cause before changing the retry logic.",
   "Leadership expects an update this week; it depends on the log analysis.",
   "Customer support raised whether merchants are told when payments fail. <b>No one took this.</b>"
  ],
  "keywords": [
   "UPI",
   "gateway timeouts",
   "evening peak",
   "merchant notifications"
  ],
  "lines": [
   [
    "03:12",
    "Kunal Bhatia",
    "I will analyse the gateway timeout logs <mark>tomorrow</mark>."
   ],
   [
    "05:40",
    "Pooja Menon",
    "I will share the list of affected merchants <mark>today</mark>."
   ],
   [
    "07:02",
    "Sneha Iyer",
    "I will configure a monitoring alert for evening failures <mark>by tomorrow</mark>."
   ],
   [
    "09:15",
    "Pooja Menon",
    "Do merchants even get a failure notification? <mark>Someone should check that.</mark>"
   ],
   [
    "11:30",
    "Amit Verma",
    "Once Kunal has the log analysis, I will update leadership <mark>on Friday</mark>."
   ]
  ]
 },
 {
  "id": "m5",
  "team": "growth",
  "title": "Diwali Campaign Performance Review",
  "date": "2026-10-06",
  "start": "16:00",
  "mins": 35,
  "overview": [
   "Diwali sale traffic up <b>38%</b>, but checkout conversion fell to 2.1%.",
   "Free-delivery threshold experiment approved for the next 7 days.",
   "Retargeting for abandoned carts to restart.",
   "Results review on Monday depends on the drop-off analysis."
  ],
  "keywords": [
   "Diwali sale",
   "checkout drop-off",
   "free delivery",
   "retargeting"
  ],
  "lines": [
   [
    "02:10",
    "Simran Kaur",
    "I will configure the free-delivery experiment <mark>tomorrow</mark>."
   ],
   [
    "04:05",
    "Varun Chopra",
    "Retargeting campaign goes live <mark>tomorrow</mark>, I will launch it."
   ],
   [
    "06:20",
    "Aditya Rao",
    "I will analyse checkout drop-offs <mark>by Friday</mark>."
   ],
   [
    "08:45",
    "Nisha Agarwal",
    "I will review campaign results <mark>on Monday</mark> once the analysis is in."
   ]
  ]
 },
 {
  "id": "m8",
  "team": "delivery",
  "title": "Delhi-NCR Delivery Performance Review",
  "date": "2026-10-06",
  "start": "10:30",
  "mins": 48,
  "overview": [
   "On-time delivery in Gurgaon fell to <b>81%</b>; Noida held at 93%.",
   "A one-week driver allocation pilot was approved.",
   "Customers will get proactive delay notifications.",
   "Pilot review next Monday."
  ],
  "keywords": [
   "on-time delivery",
   "Gurgaon",
   "driver allocation",
   "pilot"
  ],
  "lines": [
   [
    "04:30",
    "Farhan Qureshi",
    "I will create the pilot allocation model <mark>by Thursday</mark>."
   ],
   [
    "06:00",
    "Ankit Tiwari",
    "Once the model is ready I will reallocate Gurgaon drivers <mark>on Friday</mark>."
   ],
   [
    "07:40",
    "Divya Menon",
    "I can prepare the customer notification flow <mark>by Friday</mark>."
   ],
   [
    "10:10",
    "Rajeev Malhotra",
    "I will review pilot performance <mark>next Monday</mark>."
   ]
  ]
 },
 {
  "id": "m1",
  "team": "product",
  "title": "Q4 Product Release Planning",
  "date": "2026-10-05",
  "start": "15:00",
  "mins": 55,
  "overview": [
   "Analytics dashboard release planned for <b>15 Nov</b>.",
   "UAT with customers can start only after API performance testing and tablet testing.",
   "Three-step chain: dashboard UI → tablet testing → UAT.",
   "The release itself has <b>no named owner</b>."
  ],
  "keywords": [
   "Q4 release",
   "analytics dashboard",
   "UAT",
   "API performance"
  ],
  "lines": [
   [
    "05:30",
    "Priya Sharma",
    "I will complete API performance testing <mark>by 8 November</mark>."
   ],
   [
    "08:12",
    "Arjun Nair",
    "Dashboard UI will be finished <mark>by the 10th</mark>."
   ],
   [
    "10:40",
    "Neha Kapoor",
    "I will test tablet responsiveness <mark>on the 11th</mark>, after Arjun is done."
   ],
   [
    "14:05",
    "Rohan Mehta",
    "I will coordinate UAT with customers <mark>on the 12th</mark>."
   ],
   [
    "20:30",
    "James Carter",
    "So we release the analytics dashboard <mark>on 15 November</mark>."
   ]
  ]
 },
 {
  "id": "m4",
  "team": "plant",
  "title": "Production Delay & Raw Material Review",
  "date": "2026-10-05",
  "start": "09:30",
  "mins": 40,
  "overview": [
   "Line 3 lost <b>11 hours</b> of production last week to raw material shortages.",
   "Supplier delivery SLA to be renegotiated.",
   "Safety stock for critical materials to increase after the calculation.",
   "Supplier performance to be reviewed weekly. No owner was named."
  ],
  "keywords": [
   "Line 3",
   "raw material",
   "safety stock",
   "supplier SLA"
  ],
  "lines": [
   [
    "03:00",
    "Manish Gupta",
    "I will prepare the supplier performance report <mark>by Friday</mark>."
   ],
   [
    "05:15",
    "Deepak Yadav",
    "I will calculate the required safety stock <mark>by Thursday</mark>."
   ],
   [
    "06:50",
    "Kavita Joshi",
    "I will discuss the delivery SLA with the supplier <mark>on Wednesday</mark>."
   ],
   [
    "09:20",
    "Suresh Patil",
    "I will analyse the Line 3 downtime <mark>by Friday</mark>."
   ],
   [
    "12:00",
    "Rajesh Kulkarni",
    "We should review supplier performance <mark>every week</mark>."
   ]
  ]
 },
 {
  "id": "m6",
  "team": "sales",
  "title": "NCR Residential Sales Review",
  "date": "2026-10-05",
  "start": "12:00",
  "mins": 38,
  "overview": [
   "Site visits up, but only <b>6%</b> of leads convert to bookings.",
   "Sales team to focus on high-intent leads.",
   "Training on the new process follows the lead criteria.",
   "Conversion comparison next Monday."
  ],
  "keywords": [
   "lead quality",
   "site visits",
   "conversion",
   "NCR projects"
  ],
  "lines": [
   [
    "02:40",
    "Mohit Khanna",
    "I will define the high-intent lead criteria <mark>by Wednesday</mark>."
   ],
   [
    "05:00",
    "Pankaj Sethi",
    "I will train the sales team on the new process <mark>on Thursday</mark>."
   ],
   [
    "07:30",
    "Shweta Arora",
    "I will update the campaign creatives <mark>by Friday</mark>."
   ],
   [
    "10:00",
    "Abhishek Jain",
    "I will compare conversion rates <mark>next Monday</mark>."
   ]
  ]
 },
 {
  "id": "m7",
  "team": "learning",
  "title": "Student Engagement & Course Completion",
  "date": "2026-10-02",
  "start": "17:00",
  "mins": 30,
  "overview": [
   "Course completion is at <b>34%</b>; most drop-off happens in week 3.",
   "Decisions: weekly doubt-solving sessions, an inactive-student dashboard, personalised reminders.",
   "The meeting ended with <b>decisions but no action items</b>."
  ],
  "keywords": [
   "completion rate",
   "week 3 drop-off",
   "doubt sessions",
   "reminders"
  ],
  "lines": [
   [
    "06:00",
    "Ishita Bose",
    "Let us introduce <mark>weekly doubt-solving sessions</mark>."
   ],
   [
    "09:10",
    "Ritu Sharma",
    "We need a <mark>dashboard of inactive students</mark>."
   ],
   [
    "12:30",
    "Karan Malhotra",
    "And <mark>personalised reminders</mark> instead of generic emails."
   ]
  ]
 },
 {
  "id": "m9",
  "team": "payments",
  "title": "Payments Weekly Standup",
  "date": "2026-10-05",
  "start": "10:00",
  "mins": 30,
  "overview": [
   "Refund retries are still manual for two banks.",
   "Settlement mismatch report is due for review before month-end.",
   "A flaky payment webhook test is blocking two releases."
  ],
  "keywords": [
   "refunds",
   "settlement",
   "webhook tests",
   "standup"
  ],
  "lines": [
   [
    "02:10",
    "Sneha Iyer",
    "I will update the refund retry runbook <mark>by Friday</mark>."
   ],
   [
    "04:00",
    "Sneha Iyer",
    "I will share the UPI success-rate dashboard with ops <mark>today</mark>."
   ],
   [
    "06:30",
    "Kunal Bhatia",
    "I will review the settlement mismatch report <mark>by Tuesday</mark>."
   ],
   [
    "08:15",
    "Sneha Iyer",
    "I will fix the flaky payment webhook test <mark>tomorrow</mark>."
   ]
  ]
 },
 {
  "id": "m3",
  "team": "opd",
  "title": "OPD Appointment & Patient Waiting Time Review",
  "date": "2026-10-01",
  "start": "08:30",
  "mins": 45,
  "overview": [
   "Average OPD waiting time is <b>52 minutes</b> against a 30-minute target.",
   "Revised appointment schedule and WhatsApp reminders approved.",
   "Waiting times to be monitored for two weeks, then reviewed."
  ],
  "keywords": [
   "OPD",
   "waiting time",
   "appointment slots",
   "WhatsApp reminders"
  ],
  "lines": [
   [
    "04:00",
    "Vikram Singh",
    "I will create the revised appointment schedule <mark>by Monday</mark>."
   ],
   [
    "06:10",
    "Dr. Ananya Rao",
    "I will review the new schedule <mark>on Monday</mark>."
   ],
   [
    "08:20",
    "Rahul Desai",
    "I will set up WhatsApp reminders <mark>by Friday</mark>."
   ],
   [
    "10:45",
    "Meera Pillai",
    "I will monitor patient waiting times <mark>for two weeks</mark>."
   ]
  ]
 }
];

export interface SeedCommitment { id: string; m: string; text: string; owner: string; said: string; due: string; status: string; q: number; h: [string, string][]; dep?: string; trk?: string; trkClosed?: boolean; pending?: string; sent?: string[]; }
export const SEED: SeedCommitment[] = [
 {
  "id": "c21",
  "m": "m2",
  "text": "Analyse gateway timeout logs",
  "owner": "Kunal Bhatia",
  "said": "tomorrow",
  "due": "2026-10-08",
  "status": "Confirmed",
  "trk": "PAY-142",
  "q": 0,
  "h": [
   [
    "2026-10-07T12:05",
    "Confirmed by Kunal in Slack and added to Jira (PAY-142)"
   ],
   [
    "2026-10-08T09:30",
    "Reminder sent: due today"
   ]
  ],
  "sent": [
   "due"
  ]
 },
 {
  "id": "c22",
  "m": "m2",
  "text": "Share affected merchant list",
  "owner": "Pooja Menon",
  "said": "today",
  "due": "2026-10-07",
  "status": "Done",
  "q": 1,
  "h": [
   [
    "2026-10-07T11:58",
    "Confirmed by Pooja in Slack"
   ],
   [
    "2026-10-07T17:40",
    "Marked done by Pooja in Slack"
   ]
  ]
 },
 {
  "id": "c23",
  "m": "m2",
  "text": "Configure evening failure monitoring alert",
  "owner": "Sneha Iyer",
  "said": "by tomorrow",
  "due": "2026-10-08",
  "status": "Suggested",
  "q": 2,
  "h": []
 },
 {
  "id": "c24",
  "m": "m2",
  "text": "Check whether merchants get failure notifications",
  "owner": "",
  "said": "",
  "due": "",
  "status": "Unclaimed",
  "q": 3,
  "h": []
 },
 {
  "id": "c25",
  "m": "m2",
  "text": "Update leadership on UPI failures",
  "owner": "Amit Verma",
  "said": "on Friday",
  "due": "2026-10-09",
  "dep": "c21",
  "status": "Waiting",
  "q": 4,
  "h": [
   [
    "2026-10-07T12:20",
    "Confirmed by Amit in Slack. Waiting on Kunal's log analysis"
   ]
  ]
 },
 {
  "id": "c91",
  "m": "m9",
  "text": "Update the refund retry runbook",
  "owner": "Sneha Iyer",
  "said": "by Friday",
  "due": "2026-10-09",
  "status": "Confirmed",
  "trk": "PAY-139",
  "q": 0,
  "h": [
   [
    "2026-10-05T11:02",
    "Confirmed by Sneha in Slack and added to Jira (PAY-139)"
   ]
  ]
 },
 {
  "id": "c92",
  "m": "m9",
  "text": "Share the UPI success-rate dashboard with ops",
  "owner": "Sneha Iyer",
  "said": "today",
  "due": "2026-10-05",
  "status": "Done",
  "q": 1,
  "h": [
   [
    "2026-10-05T10:50",
    "Confirmed by Sneha in Slack"
   ],
   [
    "2026-10-05T16:20",
    "Marked done by Sneha in Slack"
   ]
  ]
 },
 {
  "id": "c93",
  "m": "m9",
  "text": "Review the settlement mismatch report",
  "owner": "Kunal Bhatia",
  "said": "by Tuesday",
  "due": "2026-10-13",
  "status": "PendingAccept",
  "pending": "Sneha Iyer",
  "q": 2,
  "h": [
   [
    "2026-10-08T09:50",
    "Kunal asked Sneha to take this on in Slack. Waiting for Sneha to accept"
   ]
  ]
 },
 {
  "id": "c94",
  "m": "m9",
  "text": "Fix the flaky payment webhook test",
  "owner": "Sneha Iyer",
  "said": "tomorrow",
  "due": "2026-10-06",
  "status": "Confirmed",
  "trk": "PAY-140",
  "q": 3,
  "h": [
   [
    "2026-10-05T10:55",
    "Confirmed by Sneha in Slack and added to Jira (PAY-140)"
   ],
   [
    "2026-10-06T09:30",
    "Reminder sent: due today"
   ],
   [
    "2026-10-07T09:30",
    "Overdue message sent (last reminder)"
   ]
  ],
  "sent": [
   "due",
   "overdue"
  ]
 },
 {
  "id": "c51",
  "m": "m5",
  "text": "Configure free-delivery experiment",
  "owner": "Simran Kaur",
  "said": "tomorrow",
  "due": "2026-10-07",
  "status": "Done",
  "trk": "Task #4812",
  "trkClosed": true,
  "q": 0,
  "h": [
   [
    "2026-10-06T16:50",
    "Confirmed by Simran in Slack and added to Asana"
   ],
   [
    "2026-10-07T09:30",
    "Reminder sent: due today"
   ],
   [
    "2026-10-07T14:15",
    "Marked done in Asana. Synced back"
   ]
  ]
 },
 {
  "id": "c52",
  "m": "m5",
  "text": "Launch retargeting campaign",
  "owner": "Varun Chopra",
  "said": "tomorrow",
  "due": "2026-10-07",
  "status": "Confirmed",
  "q": 1,
  "h": [
   [
    "2026-10-06T17:30",
    "Confirmed by Varun in Slack"
   ],
   [
    "2026-10-07T09:30",
    "Reminder sent: due today"
   ],
   [
    "2026-10-08T09:30",
    "Overdue message sent (last reminder)"
   ]
  ],
  "sent": [
   "due",
   "overdue"
  ]
 },
 {
  "id": "c53",
  "m": "m5",
  "text": "Analyse checkout drop-offs",
  "owner": "Aditya Rao",
  "said": "by Friday",
  "due": "2026-10-09",
  "status": "Confirmed",
  "trk": "Task #4815",
  "q": 2,
  "h": [
   [
    "2026-10-06T18:02",
    "Confirmed by Aditya in Slack and added to Asana"
   ]
  ]
 },
 {
  "id": "c54",
  "m": "m5",
  "text": "Review Diwali campaign results",
  "owner": "Nisha Agarwal",
  "said": "on Monday",
  "due": "2026-10-12",
  "dep": "c53",
  "status": "Waiting",
  "q": 3,
  "h": [
   [
    "2026-10-06T16:45",
    "Confirmed by Nisha in Slack. Waiting on Aditya's analysis"
   ]
  ]
 },
 {
  "id": "c81",
  "m": "m8",
  "text": "Create pilot allocation model",
  "owner": "Farhan Qureshi",
  "said": "by Thursday",
  "due": "2026-10-08",
  "status": "Confirmed",
  "trk": "LOG-77",
  "q": 0,
  "h": [
   [
    "2026-10-06T11:40",
    "Confirmed by Farhan in Slack and added to Jira (LOG-77)"
   ],
   [
    "2026-10-08T09:30",
    "Reminder sent: due today"
   ]
  ],
  "sent": [
   "due"
  ]
 },
 {
  "id": "c82",
  "m": "m8",
  "text": "Reallocate Gurgaon drivers",
  "owner": "Ankit Tiwari",
  "said": "on Friday",
  "due": "2026-10-09",
  "dep": "c81",
  "status": "Waiting",
  "q": 1,
  "h": [
   [
    "2026-10-06T12:10",
    "Confirmed by Ankit in Slack. Waiting on Farhan's model"
   ]
  ]
 },
 {
  "id": "c83",
  "m": "m8",
  "text": "Prepare customer delay notification flow",
  "owner": "Divya Menon",
  "said": "by Friday",
  "due": "2026-10-09",
  "status": "Suggested",
  "q": 2,
  "h": [
   [
    "2026-10-07T11:20",
    "Reminder sent: still needs confirmation"
   ]
  ],
  "sent": [
   "confirm"
  ]
 },
 {
  "id": "c84",
  "m": "m8",
  "text": "Review pilot performance",
  "owner": "Rajeev Malhotra",
  "said": "next Monday",
  "due": "2026-10-12",
  "dep": "c82",
  "status": "Waiting",
  "q": 3,
  "h": [
   [
    "2026-10-06T11:35",
    "Confirmed by Rajeev in Slack. Waiting on Ankit"
   ]
  ]
 },
 {
  "id": "c11",
  "m": "m1",
  "text": "Complete API performance testing",
  "owner": "Priya Sharma",
  "said": "by 8 November",
  "due": "2026-11-08",
  "status": "Confirmed",
  "trk": "Task #4790",
  "q": 0,
  "h": [
   [
    "2026-10-05T16:30",
    "Confirmed by Priya in Teams and added to Asana"
   ]
  ]
 },
 {
  "id": "c12",
  "m": "m1",
  "text": "Finish analytics dashboard UI",
  "owner": "Arjun Nair",
  "said": "by the 10th",
  "due": "2026-11-10",
  "status": "Suggested",
  "q": 1,
  "h": []
 },
 {
  "id": "c13",
  "m": "m1",
  "text": "Test tablet responsiveness",
  "owner": "Neha Kapoor",
  "said": "on the 11th",
  "due": "2026-11-11",
  "dep": "c12",
  "status": "Suggested",
  "q": 2,
  "h": []
 },
 {
  "id": "c14",
  "m": "m1",
  "text": "Coordinate UAT with customers",
  "owner": "Rohan Mehta",
  "said": "on the 12th",
  "due": "2026-11-12",
  "dep": "c13",
  "status": "Waiting",
  "q": 3,
  "h": [
   [
    "2026-10-05T16:20",
    "Confirmed by Rohan in Teams. Waiting on Neha's testing"
   ]
  ]
 },
 {
  "id": "c15",
  "m": "m1",
  "text": "Release analytics dashboard",
  "owner": "",
  "said": "on 15 November",
  "due": "2026-11-15",
  "status": "Unclaimed",
  "q": 4,
  "h": []
 },
 {
  "id": "c41",
  "m": "m4",
  "text": "Prepare supplier performance report",
  "owner": "Manish Gupta",
  "said": "by Friday",
  "due": "2026-10-09",
  "status": "Confirmed",
  "trk": "MFG-31",
  "q": 0,
  "h": [
   [
    "2026-10-05T10:40",
    "Confirmed by Manish in Slack and added to Jira (MFG-31)"
   ]
  ]
 },
 {
  "id": "c42",
  "m": "m4",
  "text": "Calculate required safety stock",
  "owner": "Deepak Yadav",
  "said": "by Thursday",
  "due": "2026-10-08",
  "status": "Confirmed",
  "q": 1,
  "h": [
   [
    "2026-10-05T11:15",
    "Confirmed by Deepak in Slack"
   ],
   [
    "2026-10-08T09:30",
    "Reminder sent: due today"
   ]
  ],
  "sent": [
   "due"
  ]
 },
 {
  "id": "c43",
  "m": "m4",
  "text": "Discuss delivery SLA with supplier",
  "owner": "Kavita Joshi",
  "said": "on Wednesday",
  "due": "2026-10-07",
  "status": "Done",
  "q": 2,
  "h": [
   [
    "2026-10-05T10:20",
    "Confirmed by Kavita in Slack"
   ],
   [
    "2026-10-07T09:30",
    "Reminder sent: due today"
   ],
   [
    "2026-10-07T15:05",
    "Marked done by Kavita in Slack"
   ]
  ]
 },
 {
  "id": "c44",
  "m": "m4",
  "text": "Analyse Line 3 downtime",
  "owner": "Suresh Patil",
  "said": "by Friday",
  "due": "2026-10-09",
  "status": "PendingAccept",
  "pending": "Deepak Yadav",
  "q": 3,
  "h": [
   [
    "2026-10-06T10:05",
    "Suresh asked Deepak to take this on. Waiting for Deepak to accept"
   ]
  ]
 },
 {
  "id": "c45",
  "m": "m4",
  "text": "Review supplier performance weekly",
  "owner": "",
  "said": "every week",
  "due": "",
  "status": "Unclaimed",
  "q": 4,
  "h": []
 },
 {
  "id": "c61",
  "m": "m6",
  "text": "Define high-intent lead criteria",
  "owner": "Mohit Khanna",
  "said": "by Wednesday",
  "due": "2026-10-07",
  "status": "Done",
  "trk": "RE-58",
  "trkClosed": true,
  "q": 0,
  "h": [
   [
    "2026-10-05T12:50",
    "Confirmed by Mohit in Teams and added to Jira (RE-58)"
   ],
   [
    "2026-10-07T11:00",
    "Jira issue RE-58 moved to Done. Synced back"
   ]
  ]
 },
 {
  "id": "c62",
  "m": "m6",
  "text": "Train sales team on the new process",
  "owner": "Pankaj Sethi",
  "said": "on Thursday",
  "due": "2026-10-08",
  "status": "Confirmed",
  "q": 1,
  "h": [
   [
    "2026-10-05T13:10",
    "Confirmed by Pankaj in Teams. Waiting on Mohit's criteria"
   ],
   [
    "2026-10-07T11:00",
    "Unblocked: Mohit finished the lead criteria"
   ],
   [
    "2026-10-08T09:30",
    "Reminder sent: due today"
   ]
  ],
  "sent": [
   "due"
  ]
 },
 {
  "id": "c63",
  "m": "m6",
  "text": "Update campaign creatives",
  "owner": "Shweta Arora",
  "said": "by Friday",
  "due": "2026-10-09",
  "status": "Dropped",
  "q": 2,
  "h": [
   [
    "2026-10-05T13:30",
    "Confirmed by Shweta in Teams"
   ],
   [
    "2026-10-06T10:00",
    "Dropped by Shweta in Teams: campaign paused for festive pricing"
   ]
  ]
 },
 {
  "id": "c64",
  "m": "m6",
  "text": "Compare conversion rates",
  "owner": "Abhishek Jain",
  "said": "next Monday",
  "due": "2026-10-12",
  "dep": "c62",
  "status": "Waiting",
  "q": 3,
  "h": [
   [
    "2026-10-05T13:02",
    "Confirmed by Abhishek in Teams. Waiting on Pankaj's training"
   ]
  ]
 },
 {
  "id": "c71",
  "m": "m7",
  "text": "Introduce weekly doubt-solving sessions",
  "owner": "",
  "said": "",
  "due": "",
  "status": "Unclaimed",
  "q": 0,
  "h": []
 },
 {
  "id": "c72",
  "m": "m7",
  "text": "Create an inactive-student dashboard",
  "owner": "Karan Malhotra",
  "said": "",
  "due": "2026-10-13",
  "status": "Confirmed",
  "q": 1,
  "h": [
   [
    "2026-10-05T10:15",
    "Assigned by Ishita from the Commitments page"
   ],
   [
    "2026-10-05T11:02",
    "Confirmed by Karan by email. Picked a due date: Tue 13 Oct"
   ]
  ]
 },
 {
  "id": "c73",
  "m": "m7",
  "text": "Send personalised reminders instead of generic emails",
  "owner": "",
  "said": "",
  "due": "",
  "status": "Unclaimed",
  "q": 2,
  "h": []
 },
 {
  "id": "c31",
  "m": "m3",
  "text": "Create revised appointment schedule",
  "owner": "Vikram Singh",
  "said": "by Monday",
  "due": "2026-10-05",
  "status": "Done",
  "q": 0,
  "h": [
   [
    "2026-10-01T10:02",
    "Confirmed by Vikram by email"
   ],
   [
    "2026-10-05T09:30",
    "Reminder sent: due today"
   ],
   [
    "2026-10-05T13:40",
    "Marked done by Vikram by email"
   ]
  ]
 },
 {
  "id": "c32",
  "m": "m3",
  "text": "Review the new appointment schedule",
  "owner": "Dr. Ananya Rao",
  "said": "on Monday",
  "due": "2026-10-05",
  "dep": "c31",
  "status": "Done",
  "q": 1,
  "h": [
   [
    "2026-10-01T09:50",
    "Confirmed by Dr. Ananya by email. Waiting on Vikram"
   ],
   [
    "2026-10-05T13:40",
    "Unblocked: Vikram finished the schedule"
   ],
   [
    "2026-10-06T10:30",
    "Marked done by Dr. Ananya by email"
   ]
  ]
 },
 {
  "id": "c33",
  "m": "m3",
  "text": "Set up WhatsApp appointment reminders",
  "owner": "Rahul Desai",
  "said": "by Friday",
  "due": "2026-10-02",
  "status": "Confirmed",
  "q": 2,
  "h": [
   [
    "2026-10-01T11:30",
    "Confirmed by Rahul by email"
   ],
   [
    "2026-10-02T09:30",
    "Reminder sent: due today"
   ],
   [
    "2026-10-05T09:30",
    "Overdue message sent (last reminder)"
   ]
  ],
  "sent": [
   "due",
   "overdue"
  ]
 },
 {
  "id": "c34",
  "m": "m3",
  "text": "Monitor patient waiting times",
  "owner": "Meera Pillai",
  "said": "for two weeks",
  "due": "2026-10-15",
  "status": "Confirmed",
  "q": 3,
  "h": [
   [
    "2026-10-01T10:45",
    "Confirmed by Meera by email"
   ]
  ]
 },
 {
  "id": "c35",
  "m": "m3",
  "text": "Review waiting times after two weeks",
  "owner": "",
  "said": "after two weeks",
  "due": "2026-10-15",
  "status": "Unclaimed",
  "q": 3,
  "h": []
 }
];
