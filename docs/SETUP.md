# Setup: deploy on your domain and connect Slack, Teams, Jira and email

The finished setup looks like this:

- The app runs at `https://commitments.yourdomain.com` (Render, free plan).
- Its data lives in PostgreSQL (Neon, free plan).
- Slack, Teams, email and Jira are connected, and the demo's messages go to your own Slack account and inbox.

It takes about 45 minutes the first time. Do the steps in order, because the Slack and Jira steps need the app's address. Menu names in Slack, Teams, Jira, Render and Neon change from time to time, so look for the closest match if a label differs slightly.

---

## 1. Put the code on GitHub

```bash
cd fireflies-commitments
git add . && git commit -m "Fireflies Commitments"
git branch -M main
git remote add origin https://github.com/<you>/fireflies-commitments.git
git push -u origin main
```

## 2. Database: Neon (PostgreSQL)

1. Sign up at **neon.tech** and create a project (region: **Asia Pacific (Singapore)** is closest to India).
2. On the project dashboard, open **Connect** and copy the connection string. It looks like `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`.
3. Keep it for step 3. You don't have to create any tables: the app creates them from `database/schema.sql` and loads the demo data the first time it starts.

## 3. App: Render

1. Sign up at **render.com** with GitHub.
2. Click **New → Blueprint**, pick your repo, and Render reads `render.yaml`. Alternatively, click **New → Web Service** and set:
   - Build command: `npm run build`
   - Start command: `npm start`
   - Instance type: **Free**
   - Health check path: `/api/health`
3. Under **Environment**, add:
   - `DATABASE_URL`: the Neon string from step 2.
   - `PUBLIC_URL`: for now, `https://<your-service>.onrender.com`. You'll change it in step 4.
   - Leave the Slack, Teams, Jira and email keys empty for now.
4. Deploy. Open the `onrender.com` address and you should see the app with 8 demo teams.

> **Free plan sleep.** A free Render service sleeps after 15 minutes without visits, and the first request then takes up to about a minute. To keep it awake during your demo week, create a free job at **cron-job.org** that opens `https://<your-app>/api/health` every 10 minutes. This also keeps the hourly reminder job running. One always-on service fits inside Render's free monthly hours.

## 4. Your domain

1. In Render, open your service, go to **Settings → Custom Domains → Add**, and enter `commitments.yourdomain.com`.
2. At your domain provider (GoDaddy, Hostinger, Namecheap, Cloudflare…), add a **CNAME** record:
   - Name: `commitments`
   - Value: `<your-service>.onrender.com`

   If you use Cloudflare, set the record to "DNS only" until Render shows *Verified*.
3. Wait until Render shows the certificate as issued, usually a few minutes.
4. Change `PUBLIC_URL` to `https://commitments.yourdomain.com` and save. Render redeploys.

From here on, use your own domain everywhere.

## 5. Slack (real messages with working buttons)

1. Go to **api.slack.com/apps → Create New App → From an app manifest** and pick your workspace.
2. Paste `docs/slack-app-manifest.yml`, replacing `YOUR-DOMAIN` with `commitments.yourdomain.com`. Then click **Create**.
3. Click **Install to Workspace** and choose **Allow**.
4. Copy two values into Render's **Environment**:
   - **OAuth & Permissions → Bot User OAuth Token** (starts with `xoxb-`) goes into `SLACK_BOT_TOKEN`.
   - **Basic Information → App Credentials → Signing Secret** goes into `SLACK_SIGNING_SECRET`.
5. In Slack, click your profile picture, then **Profile → ⋯ → Copy member ID** (it looks like `U0123ABCD`).
6. In the app, open **Settings → Demo setup → Demo routing**, paste the member ID and click **Save routing**.

The messages arrive as a DM from **Fireflies Commitments**, under **Apps** in the Slack sidebar.

If you created the app without the manifest, make sure **Interactivity & Shortcuts** is **On**. The Request URL is shown in the app under Settings → Webhook addresses: `https://commitments.yourdomain.com/api/slack/interactions`.

## 6. Microsoft Teams

You need a work or school Microsoft 365 account.

1. In Teams, open the channel you want, then **⋯ → Workflows**. Pick the template **"Post to a channel when a webhook request is received"**.
2. Name it *Fireflies Commitments*, choose the team and channel, and click **Add workflow**.
3. Copy the URL it shows and add it to Render as `TEAMS_WEBHOOK_URL`.
4. In the app, sign in as a manager (for example Mohit Khanna, Sales). Go to **Settings → Send messages in → Teams**, and tick that team under **Send real messages for**.

Teams cards can't call the app back the way Slack buttons do. Instead, each button opens a short page in the app (`/act`). That page shows what will change and asks for one click.

## 7. Email (Resend or SMTP)

**Resend (used first when set):** resend.com → **API Keys → Create** → `RESEND_API_KEY`. Set `RESEND_FROM_EMAIL` to an address on a domain you verified in Resend (Domains → Add, then add its DNS records), or to `onboarding@resend.dev`, which only delivers to your Resend sign-up address.

**SMTP (fallback, or instead of Resend):** any mailbox that allows SMTP works. Add these four values (in `.env` locally, or in Render's Environment):

| Provider | `SMTP_HOST` | `SMTP_PORT` | `SMTP_USER` / `SMTP_PASS` |
|---|---|---|---|
| Gmail | `smtp.gmail.com` | `465` | your Gmail address and a 16-letter **App Password** (Google Account → Security → 2-Step Verification on → App passwords) |
| Outlook / Microsoft 365 | `smtp.office365.com` | `587` | your address and password (SMTP AUTH must be allowed for the mailbox) |
| Your domain (Hostinger, Zoho, GoDaddy…) | the SMTP server your provider shows | `465` or `587` | the mailbox address and its password |

`EMAIL_FROM` is optional; it defaults to "Fireflies Commitments <SMTP_USER>". In the app, set **Settings → Demo routing → Demo inbox** to where you want the demo emails. **Settings → Test connections** checks the SMTP login.

Note: some free hosting plans (including Render's free plan) can block outgoing SMTP ports. Locally it works. If emails fail only on the hosted app with a timeout, that is the cause: use a paid instance or your provider's HTTP email API.

## 8. Jira

1. Make sure you have a **Jira** project (open `https://<you>.atlassian.net/jira/projects` → **Create project**; any template works). Atlassian's separate "Projects" app (status updates) is not Jira and has no project key. Then create an API token at **id.atlassian.com/manage-profile/security/api-tokens**.
2. Add four values to Render:
   - `JIRA_BASE_URL`: `https://<you>.atlassian.net`
   - `JIRA_EMAIL`: your Atlassian login email
   - `JIRA_API_TOKEN`: the token from step 1
   - `JIRA_PROJECT_KEY`: the letters before your issue numbers, for example `KAN`
3. **Jira → Fireflies (optional, but it completes the loop):**
   1. In Jira, go to **Settings (gear) → System → WebHooks → Create a WebHook**.
   2. URL: copy it from the app's **Settings → Webhook addresses**. It ends in `/api/jira/webhook?secret=…`.
   3. Events: **Issue → updated**.
   4. JQL filter (optional): `labels = fireflies-commitment`.

   Now moving an issue to Done in Jira closes the commitment in Fireflies. Changing its due date in Jira moves it in Fireflies too.
4. In the app, go to **Settings → Test connections**. Jira should say "Connected as <your name> · project KAN · new issues are "Task"". The app uses the project's "Task" type, or its first normal issue type if there is no Task.

**What Fireflies does in Jira**

| In Fireflies (app, Slack, Teams or email) | In Jira |
|---|---|
| **Confirm + add to Jira** | A Task is created with the due date, assigned to **you** (the API-token user). The description starts with **"Owner: Neha Kapoor"**, plus the meeting and the quote, and has the labels `fireflies-commitment` and `owner-neha-kapoor`. A plain **Confirm** creates nothing in Jira. |
| Jira status | Confirmed and free to start → **In Progress**. Waiting on the step before, not confirmed yet, or no owner → **To Do**. Done or dropped → **Done**. Set only when the commitment's state changes, so a status you set by hand (for example In Review) stays until then. |
| A step waits on another one that is also in Jira | Issue link: **KAN-1 blocks KAN-2** |
| Due date changed, "Need 1 more day", or a step before it moved | **Due date** updated, plus a comment saying why |
| Reassign asked, accepted or declined | A comment for each step. On accept, the **Owner** line and the owner label change to the new person, and the date stays. |
| Not confirmed in 2 working days, or the second failed hand-over | Owner becomes "No owner yet (with the manager to assign)", plus a comment |
| Manager assigns it | Owner updated, plus a comment |
| Marked done | Moved to **Done**, plus a comment ("Marked done by James in Slack") |
| Dropped | Moved to **Done**, plus the comment "Dropped by … : the owner decided not to do this" |
| **Moved to Done in Jira** | The commitment closes in Fireflies ("Done in Jira"), and whoever waits on it is told they can start. Needs the webhook. |
| **Moved back out of Done in Jira** (for example to In Progress) | The commitment opens again, and the steps after it go back to waiting. Needs the webhook. |
| **Due date changed in Jira** | The commitment's date changes in Fireflies, and the steps after it move. Needs the webhook. |

For the demo every issue is assigned to you, because Jira can only assign people who have a user in your Jira site. In a real company each owner would be matched to their Jira user by email.
If your project hides the Due date or Assignee field on its create screen, the app creates the issue without that field and then sets the due date separately. If the Assignee field is hidden, the issue stays unassigned.

---

## 9. The next meeting: pre-read, meeting chat, upcoming commitments

In the product, the next meeting comes from the calendar (Google Calendar, Outlook or Teams), and Fred joins it as a participant. Because he is in the call, he can type in the meeting chat like anyone else, so no special API is needed.

1. **30 minutes before the meeting.** A pre-read goes to the team channel (`#release-sync`): *From our last meeting · <meeting> (<date>)* with **Completed**, **Remaining** and **Needs an owner**. It shows titles only, no names. The manager gets a private card with an **Assign to…** picker for each item without a confirmed owner.
2. **2 minutes after the meeting starts.** Fred reads the latest status from the database and posts it in the meeting chat. When someone joins later, he posts it in the chat again.
3. **When the meeting ends.** Fireflies' AI summary comes in. The channel gets *Upcoming commitments from <meeting> (<date>)*, with titles and due dates only. Each owner gets their private card to confirm, as for any meeting. An item with no owner goes to the manager.

In this prototype:

- **Team channel.** Make a Slack channel (e.g. `#release-sync`) and type `/invite @Fireflies Commitments` in it. Paste its channel ID (or link) in **Settings → Meeting chat Slack channel ID → Save routing**.
- **Running the meeting.** As the manager, open the meeting and use the steps, which stand in for the calendar and the call:
  - **① Meeting in 30 min · post pre-read**
  - **② Meeting starts · Fred joins**. Pick **Someone joins…** to add people. **Skip the 2-minute wait** posts right away.
  - **③ Meeting ends**. This imports `database/sample-meetings/release-sync-checkin.json`, Fireflies' summary of that next meeting.
- **The meeting chat.** It is the meeting window shown on the meeting page, and on **My Meetings** for team members while the meeting runs.
- **Assigning an item without a confirmed owner.** Use any of these; the person then gets a card to confirm:
  - **Slack:** the picker on the manager's card.
  - **Fireflies dashboard:** the **Assign to** list.
  - **Jira:** items nobody owns get a Jira issue in **To Do** with the label `owner-none`. Replace that label with the person's, e.g. `owner-priya-sharma`, or set an Assignee whose name or email matches a team member.

Due reminders, Slack cards and Jira sync work exactly as before.

## The demo, start to finish

The first three steps are setup:

1. **Settings → Demo setup.** Check that all four connections are green, that your Slack member ID and inbox are saved, and that **Product · SaaS** is ticked under *Send real messages for*.
2. **Import Fireflies meeting** (top bar) **→ Use sample: release in 5 days → Import and send cards.** Five people (Arjun, Neha, Priya, James, Rohan) each get a card in your Slack that starts "Hey Arjun, …", "Hey Neha, …". Rohan, as manager, also gets told that "Update the status page" has no owner.
3. **Signed in as Arjun Nair.** His commitment shows a timeline: tomorrow (You) → Neha's regression (+1 day) → Rohan's go/no-go (+2 days) → Rohan's release (+1 day).

Then demo each behaviour:

4. **Confirm.** In **Slack**, on the card that starts *Hey Arjun*, press **Confirm + add to Jira**.
   - The Slack message updates in place with the result.
   - A **KAN-x** issue appears in Jira.
   - The Fireflies screen updates at once: "Updated from Slack", and the Jira chip appears.
5. **Change a date.** In Slack, pick a later date on Arjun's card.
   - Neha's and Rohan's dates move by the same number of days.
   - Their Jira due dates change.
   - Each of them gets "Your date moved".
6. **Reassign.** On Arjun's card, choose **Reassign to… James Carter**.
   - James gets "Can you take this on?" with Accept and Decline.
   - **Decline** sends it back to Arjun. Decline a second time and it goes to Rohan as *Needs an owner*.
   - **Accept** gives the item to James with the same date, and Neha is told she now waits on James.
7. **Done in Jira.** Move the Jira issue to **Done**.
   - The commitment closes in Fireflies.
   - Neha gets "Your next step can start".
8. **Next morning 9:30 →** (top bar). The demo clock jumps to the next working day and sends what's due: "Due tomorrow", "Due today", "Still need your confirmation", and hand-overs nobody answered.
9. **Manager.** Sign in as **Rohan Mehta (manager)** and open **Commitments** to see All / Pending / Resolved / Needs an owner. Assign the status-page item to Priya; she gets a card to confirm.
10. **Friday report.** Go to **Settings → Friday report → Email this report now**.

To start again, use **Settings → Reset demo data**.

## Troubleshooting

| What you see | Fix |
|---|---|
| Settings → Sent messages shows "Not sent: no channel connected yet" | No Slack, Teams or email keys are set, or your Slack member ID / demo inbox is not saved in Settings. |
| A Slack button shows a warning triangle | The app was asleep (free plan). The change still goes through once it wakes. Keep it awake with the cron-job.org ping. |
| A Slack button does nothing | Check that **Interactivity** is on and the Request URL uses your domain. **Settings → Test connections** checks the bot token. |
| "Not sent: Slack chat.postMessage: channel_not_found" | The member ID is wrong, or the app isn't installed in that workspace. |
| A Jira error appears in the Jira panel | Run **Test connections**. Check the project key, and that your user can create Tasks in that project. |
| Email "Not sent: … Invalid login" | Wrong SMTP user/password. For Gmail use an App Password, not your normal password. |
| The pre-read or upcoming list does not appear in the channel | The message on the meeting page says why: no channel saved, or the app is not in the channel (`/invite @Fireflies Commitments`). |
| Teams buttons open a page saying "This link is not valid any more" | Demo data was reset after the card was sent. Import the meeting again. |
