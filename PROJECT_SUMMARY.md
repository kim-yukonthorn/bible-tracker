# ✝️ Bible Tracker Project Summary

**Bible Tracker** is a LINE LIFF web application designed to encourage users to read the Bible. It features a leaderboard system and a simple interface for logging reading progress, integrated seamlessly with LINE for authentication.

---

## 🛠 Tech Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router) |
| **Database** | Supabase (PostgreSQL) |
| **Authentication** | LINE LIFF v2 |
| **Styling** | Tailwind CSS |
| **Icons** | Lucide React |

---

## 🚀 Key Features

- **⚡ Automatic Login**  
  Uses `@line/liff` to automatically log users in and sync their profile (Display Name, Avatar) to Supabase.
- **🏆 Leaderboard**  
  Real-time leaderboard showing top readers sorted by the number of chapters read.
- **📖 Reading Log**  
  Users can select a Bible book and chapter to record their reading.
- **💯 Score Tracking**  
  Automatic score increment upon submitting a reading log.
- **🛡️ Duplicate Prevention**  
  Prevents users from logging the same chapter twice.

---

## 📂 Key File Structure

```text
/app
  ├── layout.tsx       # Wraps app with LiffProvider
  ├── page.tsx         # Leaderboard & User Summary UI
  └── /record
      └── page.tsx     # Book & Chapter selection UI

/components
  └── LiffProvider.tsx # Handles LIFF init, Login, and Supabase Sync

/data
  └── bible.ts         # Static data for 66 Bible books

/lib
  └── supabaseClient.ts # Supabase client initialization
```

---

## 🗄️ Database Schema

### `profiles` Table
*Stores user information from LINE.*

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `text` (PK) | LINE User ID |
| `display_name` | `text` | User's display name |
| `avatar_url` | `text` | Profile picture URL |
| `score` | `int` | Total chapters read |

### `reading_logs` Table
*Stores individual reading records.*

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | `bigint` (PK) | Unique record ID |
| `user_id` | `text` (FK) | Reference to `profiles.id` |
| `book_name` | `text` | Name of the Bible book |
| `chapter` | `int` | Chapter number |
| `created_at` | `timestamp` | Time of reading |

> **Constraint**: Unique combination of `user_id`, `book_name`, `chapter`.

---

## ⚙️ Setup & Run

### 1. Environment Variables
Create a `.env.local` file:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_LIFF_ID=your_liff_id
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Deploy
Deploy to Vercel (or similar) and update the **Endpoint URL** in the LINE Developers Console to your production URL.