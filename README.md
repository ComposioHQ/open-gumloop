# AgentFlow

AgentFlow is a Next.js application for designing and executing AI workflows. It lets you visually connect language models and Composio tools into custom flows that run sequentially. The project is written in TypeScript and uses Supabase for authentication and storage.

## Features

- **Visual Flow Builder** – Drag and drop nodes representing inputs, LLM calls, and tool actions under `app/builder/[flowId]`.
- **Supabase Integration** – Auth helpers live in `lib/supabase` to handle user sessions on the client and server.
- **API Routes** – The `/api/agent` endpoint executes a flow by running through its nodes.
- **Reusable Components** – UI and builder components reside in `components/` for easy reuse.

## Project Structure

```
app/            Next.js pages and API routes
components/     React components including custom nodes for the flow builder
lib/            Utility modules (Supabase client helpers, etc.)
public/         Static assets
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create an `.env` file with your Supabase credentials:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   Visit `http://localhost:3000` to load the app.

Linting is available with `npm run lint`.

## Contributing

Feel free to open issues or pull requests if you find problems or have improvements.

## License

This project does not currently include an open-source license.

