# Meet AI

**AI-Powered Video Calling Platform with Real-Time AI Agents**

Meet AI is a comprehensive SaaS video calling application where AI agents actively participate in real-time calls. Unlike traditional video calling apps that only provide summaries or transcripts, Meet AI features AI agents trained for specific roles that can actively assist during calls, whether as language tutors, interview coaches, sales assistants, or completely custom agents.

## 🚀 Key Features

- **🤖 AI-Powered Video Calls** - Real-time AI agents that actively participate in calls
- **🧠 Custom AI Agents** - Create agents for specific roles (tutors, coaches, assistants, etc.)
- **📞 Professional Video Calling** - Stream Video SDK integration with lobby, call controls
- **📝 Automated Post-Call Processing** - AI-generated summaries, searchable transcripts, recordings
- **🔍 Smart Meeting Management** - Search, filter, and organize meetings and agents
- **💬 AI Meeting Q&A** - ChatGPT-like interface that understands meeting context
- **📂 Meeting History & Status Tracking** - Complete meeting lifecycle management
- **💳 Subscription Management** - Integrated payment system with usage limits
- **🔐 Secure Authentication** - Email/password and social login support
- **📱 Mobile Responsive** - Optimized for all device sizes
- **⚙️ Background Job Processing** - Automated transcript generation and AI summarization

## 🛠️ Tech Stack

### Frontend & Framework
- **Next.js 15** with React 19 (Server Components, SSR)
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **Shadcn/ui** for accessible component library
- **Lucide React** for icons

### Backend & Database
- **tRPC** for full-stack type safety
- **PostgreSQL** via Neon Database
- **Drizzle ORM** for database management
- **Better Auth** for authentication
- **TanStack Query** for data fetching

### AI & Video
- **OpenAI API** for AI agents and real-time responses
- **Stream Video SDK** for video calling
- **Stream Chat SDK** for messaging
- **OpenAI Realtime API** for live AI interaction

### Infrastructure & Tools
- **Inngest** for background job processing
- **Ngrok** for webhook development

## 📋 Prerequisites

- **Node.js** 18.18+ (recommended: 22.15.1 LTS)
- **npm** or **yarn**
- **PostgreSQL** database (via Neon)
- **Git** for version control

## 🔧 Installation

1. **Clone the repository**
```
git clone https://github.com/Umyal06dxt/saasai.git
cd meet-ai
```

2. **Install dependencies**
```
npm install --legacy-peer-deps
```

3. **Set up environment variables**
Create a `.env` file in the root directory:
```
# Database
DATABASE_URL="your-neon-database-connection-string"

# Authentication
BETTER_AUTH_SECRET="your-random-secret-key"
BETTER_AUTH_URL="http://localhost:3000"

# OAuth (Optional)
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Stream Video
NEXT_PUBLIC_STREAM_VIDEO_API_KEY="your-stream-api-key"
STREAM_VIDEO_SECRET_KEY="your-stream-secret-key"

# OpenAI
OPENAI_API_KEY="your-openai-api-key"
```

4. **Set up the database**
```
# Push database schema
npm run database:push

# Open Drizzle Studio (optional)
npm run database:studio
```

5. **Start the development server**
```
npm run dev
```

6. **Set up webhooks (for AI functionality)**
```
# In a separate terminal
npx inngest-cli dev

# In another terminal
ngrok http 3000
```

## 🏗️ Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── (auth)/            # Authentication routes
│   ├── (dashboard)/       # Dashboard routes
│   ├── call/              # Video call interface
│   └── api/               # API routes
├── components/            # Reusable UI components
├── modules/               # Feature modules
│   ├── agents/           # AI agents management
│   ├── meetings/         # Meeting management
│   ├── auth/             # Authentication
│   ├── dashboard/        # Dashboard components
│   └── call/             # Video call components
├── lib/                  # Utility libraries
├── hooks/                # Custom React hooks
├── trpc/                 # tRPC configuration
├── database/             # Database schema and config
└── inngest/              # Background jobs
```

## 🔑 Key Components

### Agent Management
- Create custom AI agents with specific instructions
- Configure agent personalities and roles
- Manage agent settings and behavior

### Meeting Management
- Schedule meetings with AI agents
- Real-time video calling with AI participation
- Meeting status tracking (upcoming, active, processing, completed)

### Post-Call Processing
- Automatic transcript generation
- AI-powered meeting summaries
- Video recording storage
- Searchable meeting history

### Authentication & Security
- Email/password authentication
- Social login (GitHub, Google)
- Protected routes and API endpoints
- Session management

## 🚀 Usage

1. **Create an Account**: Sign up with email or social login
2. **Create AI Agents**: Define custom agents with specific roles and instructions
3. **Schedule Meetings**: Create meetings and assign AI agents
4. **Start Video Calls**: Join real-time video calls with AI agents
5. **Review Meeting Content**: Access summaries, transcripts, and recordings
6. **Ask Questions**: Use the AI Q&A to get insights about meetings


## 📝 Available Scripts

```
# Development
npm run dev                 # Start development server
npm run build              # Build for production
npm run start              # Start production server

# Database
npm run database:push      # Push schema changes
npm run database:studio    # Open Drizzle Studio

# Code Quality
npm run lint              # Run ESLint
npm run type-check        # TypeScript type checking
```

## 🐛 Troubleshooting

### Common Issues

1. **Peer Dependency Warnings**: Use `--legacy-peer-deps` flag when installing packages
2. **Database Connection**: Ensure your Neon database URL is correct
3. **Webhook Issues**: Make sure Ngrok is running and webhook URL is updated
4. **AI Agent Not Responding**: Check OpenAI API key and webhook configuration