# 💖 Little Wins

Little Wins is a mobile-first no-spend habit tracker designed as a soft self-care companion. It uses vanilla HTML, CSS, JavaScript, and Supabase. There is no framework, package installation, bundler, or frontend build step.

## Included features

- Automatic Supabase Anonymous Authentication
- One atomic check-in per local calendar day
- No-spend streaks, best streak, reward targets, and automatic rewards
- Confetti celebration, optional sounds, button ripple, loading, and page transitions
- Reward history and six automatic achievements
- Monthly calendar with no-spend, spent, empty, and today states
- Monthly summary and six-month statistics charts using Canvas/SVG
- Full wishlist CRUD, collected state, search, filter, and sort
- More than 50 deterministic daily motivational quotes
- Sakura, Strawberry, Lavender, Peach, and Bubblegum themes
- Supabase-backed settings and in-app/browser reminder support
- JSON data export and transactional restore
- Row Level Security for every user-owned table
- Responsive layouts for phones, tablets, and desktops
- Vercel runtime environment configuration through `/api/config`
- Lightweight offline shell caching through a service worker

## Project structure

```text
little-wins/
├── index.html
├── style.css
├── script.js
├── calendar.js
├── dashboard.js
├── rewards.js
├── wishlist.js
├── settings.js
├── supabase.js
├── config.js
├── service-worker.js
├── vercel.json
├── README.md
├── .env.example
├── api/
│   └── config.js
├── assets/
│   ├── icons/
│   ├── illustrations/
│   ├── fonts/
│   └── sounds/
└── supabase/
    └── schema.sql
```

## 1. Create and initialize Supabase

1. Create a new Supabase project.
2. Open **SQL Editor**.
3. Paste the complete contents of `supabase/schema.sql`.
4. Run the script once.
5. Open **Authentication → Providers** and enable **Anonymous Sign-Ins**.
6. Open the project API settings and copy:
   - Project URL
   - Anonymous key or publishable key

The schema creates all tables, indexes, functions, triggers, grants, RLS policies, and transactional RPC functions required by the application.

### Database objects

- `settings`: theme, reward goal, reminder, sound, animation, and aggregate counters
- `daily_logs`: one no-spend or spent record per user per date
- `rewards`: reward history
- `achievements`: unlocked milestone history
- `wishlist`: collectible wishlist items
- `check_in(...)`: atomic daily check-in, streak update, reward creation, and achievement evaluation
- `get_statistics()`: dashboard statistics and six-month chart data
- `get_backup_data()`: JSON backup payload
- `restore_backup_data(...)`: transactional replacement of the current anonymous user's data

Direct browser writes to `daily_logs`, `rewards`, and `achievements` are intentionally blocked. Those changes must pass through the database functions so duplicate check-ins and partial reward updates cannot occur.

## 2. Deploy to Vercel

This is the recommended setup because it allows the static app to read Vercel environment variables at runtime without a build process.

1. Upload the `little-wins` folder to a Git repository, or import the folder with the Vercel CLI.
2. Create a new Vercel project.
3. Set the framework preset to **Other**.
4. Leave the build command empty.
5. Leave the output directory empty.
6. Add these environment variables for Production, Preview, and Development:

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

7. Deploy or redeploy after saving the environment variables.

The browser requests `/api/config`; the included Vercel Function returns only the public Supabase URL and anonymous/publishable key. Never place a Supabase service-role key in this project.

## 3. Local development

### Recommended: Vercel development server

1. Copy `.env.example` to `.env.local`.
2. Fill the two variables.
3. Run the project with `vercel dev` from the project directory.
4. Open the local URL printed by Vercel.

This exercises the same `/api/config` runtime path used in production.

### Plain static server

A browser cannot read a `.env` file directly. For a plain static server, fill the two public values in `config.js`, then serve the folder with any local HTTP server. Do not open `index.html` through a `file://` URL because browser module and service-worker rules require HTTP or HTTPS.

## 4. First-run verification

After deployment:

1. Open the app in a private or fresh browser session.
2. Confirm the loading screen disappears without a login form.
3. Check Supabase **Authentication → Users**; an anonymous user should appear.
4. Tap **No Spend**.
5. Confirm one row appears in `daily_logs` and the settings counters update.
6. Attempt another check-in on the same day; the app must keep the buttons disabled and the database must reject a duplicate.
7. Temporarily set the target to one day and check in with a fresh anonymous session to verify reward creation, celebration, and achievements.
8. Add, edit, collect, search, filter, and delete a wishlist item.

## Settings and customization

### Default reward and target

Edit the defaults in `supabase/schema.sql` before initializing a new database:

```sql
reward_name text not null default 'Blind Pack'
target_days integer not null default 7
```

Existing users can change both values from the Settings page.

### Themes

Theme variables are defined near the top of `style.css`. Each body theme overrides the same design tokens:

- `--primary`
- `--secondary`
- `--background`
- `--accent`
- `--border`
- `--shadow`

The theme list and picker metadata are stored in `settings.js`.

### Quotes

Built-in quotes are stored in `dashboard.js`. A date-based deterministic selection ensures the quote remains stable for the entire local day.

### Sounds

The project includes three small generated WAV files:

- `assets/sounds/click.wav`
- `assets/sounds/reward.wav`
- `assets/sounds/achievement.wav`

Replace them with other licensed files using the same filenames, or update the paths in `script.js`.

### Fonts

Space Grotesk and Inter are loaded from Google Fonts. System-font fallbacks are included. The repository does not bundle font binaries. For a self-hosted font setup, add properly licensed WOFF2 files and replace the Google Fonts link with local `@font-face` rules.

## Reminder behavior

The reminder time is stored in Supabase. While the app is open, Little Wins checks the configured time and shows one reminder per local day. When browser notification permission is granted, it also sends a browser notification.

Web browsers do not guarantee scheduled background execution after a page is fully closed. Reliable closed-app push reminders require a push service, service-worker push subscription, and a scheduled backend sender, which are outside this no-build static scope.

## Backup and restore

### User-level JSON backup

1. Open **Settings → Your data**.
2. Select **Export my data**.
3. Store the JSON file securely.

To restore:

1. Open Little Wins under the anonymous account that should receive the data.
2. Select **Restore backup**.
3. Choose a Little Wins JSON export.
4. Confirm replacement.

Restore is transactional and replaces the current anonymous user's logs, rewards, achievements, wishlist, and settings. It does not recreate the original Supabase Auth user ID.

### Project-level backup

Use Supabase's database backup/export facilities for whole-project disaster recovery. Project-level restoration should be tested in a separate Supabase project before replacing production data.

## Anonymous account limitation

The Supabase session is persisted in browser storage. An anonymous user has no email, password, or provider identity to recover the same account after signing out, clearing site data, or losing the device/browser profile. Exporting a JSON backup regularly is therefore important. A later product version can add identity linking or a permanent login flow without changing the core tables because all records already use `auth.users.id`.

## Security notes

- The browser receives only the Supabase URL and anonymous/publishable key.
- The service-role key must never be used in frontend code or Vercel's public config endpoint.
- RLS restricts rows to `auth.uid()`.
- Daily check-ins and reward generation use a `SECURITY DEFINER` function that validates the authenticated user and accepted input.
- Database constraints enforce valid themes, statuses, priorities, target ranges, and unique daily logs.
- Wishlist text is escaped before rendering to prevent injected HTML.
- Configuration responses use `Cache-Control: no-store`.

## Browser support

The interface uses standards supported by current Chrome, Firefox, Edge, Safari, Android browsers, iPhone/iPad Safari, tablets, and desktop browsers. Browser notifications and service-worker behavior vary by platform and user permission. Core tracking, Supabase storage, calendar, rewards, wishlist, settings, and charts do not depend on notification support.

## Deployment troubleshooting

### The setup screen appears

Check that:

- `SUPABASE_URL` and `SUPABASE_ANON_KEY` exist in the active Vercel environment.
- The deployment was recreated after changing environment variables.
- `config.js` is filled when using a non-Vercel static host.
- The Supabase URL and key belong to the same project.

### Anonymous sign-in fails

Enable Anonymous Sign-Ins in Supabase Authentication settings. Also verify the project is not paused and the browser can reach Supabase.

### Tables or functions are missing

Run the full `supabase/schema.sql` file. Do not run only the table declarations; the application also requires RPC functions, grants, triggers, and RLS policies.

### Data loads but writes fail

Re-run the grants and policy section at the bottom of `schema.sql`. Confirm the session is an authenticated anonymous user rather than an unauthenticated `anon` request.

### Old frontend files remain visible

The included service worker uses a versioned shell cache. Increase `CACHE_NAME` in `service-worker.js`, redeploy, and reload. The service worker never caches `/api/config` or Supabase API traffic.
