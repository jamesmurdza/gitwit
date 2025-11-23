# GitWit 📦🪄

![Screenshot 2025-06-26 at 7 45 45 PM](https://github.com/user-attachments/assets/dbb5f9e9-1407-4e28-bc3f-14e2db0ef03d)

GitWit is an open-source cloud-based code editing environment with custom AI code generation, live preview, real-time collaboration, and AI chat.

For the latest updates, join our Discord server: [discord.gitwit.dev](https://discord.gitwit.dev/).

## Minimal Setup

A quick overview of the tech before we start: The deployment uses a **NextJS** app for the frontend and an **ExpressJS** server on the backend.

**Required accounts to get started:**

- [Clerk](https://clerk.com/): Used for user authentication.
- [E2B](https://e2b.dev/): Used for the terminals and live preview.

**AI Provider Options:**

GitWit supports multiple AI providers. You can either:

- **Use system-level API keys** (set in `.env` - recommended for development)
- **Let users configure their own API keys** via Dashboard Settings (recommended for production)

Supported providers:

- [Anthropic](https://anthropic.com/): Claude models for code generation and chat
- [OpenAI](https://openai.com/): GPT models for code generation and chat
- [OpenRouter](https://openrouter.ai/): Access to multiple AI models through a single API
- [AWS Bedrock](https://aws.amazon.com/bedrock/): Claude models via AWS infrastructure

### 1. Clone the repository

No surprise in the first step:

```bash
git clone https://github.com/jamesmurdza/gitwit
cd gitwit
```

Copy .env files:

```bash
cp .env.example .env
cp web/.env.example web/.env
cp server/.env.example server/.env
```

Install dependencies:

```bash
npm install
```

### 2. Create a database

Install and start Postgres:

```sh
brew install postgresql
brew services start postgresql
```

Create a database:

```sh
psql postgres -c "CREATE DATABASE gitwit;"
# psql postgres -U  postgres -c "CREATE DATABASE gitwit;"  # Use this if the above fails
```

Initialize the database schema (run from project directory):

```
npm run db:generate
npm run db:migrate
```

After making any changes to your database schema, run these commands again to update your local database. The migration files created are not committed to version control.

#### Production database management

<details>
<summary>Instructions</summary>

Create a `.env.production` file with your production database credentials:

```
DATABASE_URL=
```

Initialize or migrate the database:

```
npm run db:generate:prod
npm run db:migrate:prod
```

Production migration files **are** committed to version control.

</details>

### 3. Configure environment variables

Get API keys for E2B and Clerk (required), plus at least one AI provider (optional for system-level access).

Add them to the `.env` file along with the database connection string.

**Required:**

```
DATABASE_URL='🔑'
E2B_API_KEY='🔑'
CLERK_SECRET_KEY='🔑'
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY='🔑'
```

**Optional (Custom API Keys Feature):**

```
ENCRYPTION_KEY='🔑'  # 32-byte hex string for encrypting user API keys
```

To enable the custom API keys feature (allowing users to configure their own API keys), set `ENCRYPTION_KEY`. Generate one using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# or
openssl rand -base64 32
```

**Optional (System-level AI providers):**

```
OPENAI_API_KEY='🔑'
ANTHROPIC_API_KEY='🔑'
```

**Optional (AWS Bedrock):**

```
AWS_ACCESS_KEY_ID='🔑'
AWS_SECRET_ACCESS_KEY='🔑'
AWS_REGION='us-east-1'
AWS_MODEL_ID='qwen.qwen3-32b-v1:0'
# AWS_MODEL_ID='qwen.qwen3-coder-30b-a3b-v1:0'
```

**Note:**

- If `ENCRYPTION_KEY` is not set, the custom API keys feature will be disabled, but the app will still work using system-level API keys.
- You must provide at least one of: `ENCRYPTION_KEY` (for user-configured keys) OR system-level API keys (`OPENAI_API_KEY`/`ANTHROPIC_API_KEY`).

### 4. Run the IDE

Start the web app and server in development mode:

```bash
npm run dev
```

## Features

### Custom API Key Management

Users can configure their own API keys for AI providers through **Dashboard Settings**:

1. Navigate to Dashboard → Settings → API Keys
2. Configure keys for any supported provider:
   - **Anthropic**: Access to Claude models (Sonnet, Opus, Haiku)
   - **OpenAI**: Access to GPT-4.1 series models
   - **OpenRouter**: Access to multiple AI models with custom model IDs
   - **AWS Bedrock**: Claude models via AWS infrastructure
3. Optionally specify custom model IDs for each provider
4. API keys are encrypted using AES-256-GCM before storage

**Model Selection:**

- The chat interface automatically shows available models based on configured API keys
- Users can switch between models using the dropdown in the chat input
- If no model is specified, sensible defaults are provided for each provider

**Priority Order:**
When multiple providers are configured, the system uses this priority: OpenRouter > Anthropic > OpenAI > AWS Bedrock

### User Profiles & Dashboard

Users have access to a comprehensive dashboard with:

- **Profile Management**: Edit name, username, bio, personal website, and social links
- **API Keys**: Securely configure and manage AI provider credentials
- **Sandboxes**: View, manage visibility (public/private), and delete projects
- **Public Profiles**: Each user gets a public profile page at `/@username` showing their public projects

### Supported AI Models

**Anthropic (Claude):**

- Claude Sonnet 4.5
- Claude Haiku 4.5
- Claude Opus 4.1
- Claude Sonnet 4
- Claude Opus 4
- Claude Sonnet 3.7
- Claude Haiku 3.5

**OpenAI (GPT):**

- GPT-4.1
- GPT-4.1 Nano
- GPT-4.1 Mini

**OpenRouter & AWS:** Custom model IDs supported

## Optional setup

### Add GitHub integration

<details>
<summary>Instructions</summary>

Setup GitHub OAuth for authentication.

Update `.env`:

```
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

To get your GitHub Client ID and Client Secret:

1. Go to [GitHub Developer Settings](https://github.com/settings/developers) and create a new OAuth App
2. Set the "Authorization callback URL" to `http://localhost:3000/loading` if running locally
3. Set the "Homepage URL" to `http://localhost:3000` if running locally
4. Get the "Client ID" and "Client Secret" from the OAuth App

To get a Personal Access Token (PAT):

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "GitWit Testing")
4. Select the necessary scopes (typically `repo`, `user`, `read:org`)
5. Generate the token and copy it securely
</details>

### Add Deployments

<details>
<summary>Instructions</summary>

The steps above do not include steps to setup [Dokku](https://github.com/dokku/dokku), which is required for deployments.

**Note:** This is completely optional to set up if you just want to run GitWit.

Setting up deployments first requires a separate domain (such as gitwit.app, which we use).

We then deploy Dokku on a separate server, according to this guide: <https://dev.to/jamesmurdza/host-your-own-paas-platform-as-a-service-on-amazon-web-services-3f0d>

And we install [dokku-daemon](https://github.com/dokku/dokku-daemon) with the following commands:

```
git clone https://github.com/dokku/dokku-daemon
cd dokku-daemon
sudo make install
systemctl start dokku-daemon
```

The GitWit platform connects to the Dokku server via SSH, using SSH keys specifically generated for this connection. The SSH key is stored on the GitWit server, and the following environment variables are set in `.env`:

```bash
DOKKU_HOST=
DOKKU_USERNAME=
DOKKU_KEY=
```

</details>

## Creating Custom Templates

<details>
<summary>Instructions</summary>

Templates are pre-built environments which serve as the basis for new projects. Each template is spawned from its own [E2B sandbox template](https://e2b.dev/docs/sandbox-template).

Each template is a directory inside the `templates` directory. The template should have at least an `e2b.Dockerfile`, which is used by E2B to create the development environment. Optionally, a `Dockerfile` can be added which will be [used by Dokku](https://dokku.com/docs/deployment/builders/builder-management/) to create the project build when it is deployed.

To deploy and test templates, you must have an [E2B account](https://e2b.dev/) and the [E2B CLI tools](https://e2b.dev/docs/cli) installed. Then, run:

```
e2b auth login
```

To deploy a template to E2B, run:

```
npm run templates:deploy [TEMPLATENAME]
```

Leaving out the TEMPLATENAME parameter will redeploy all previously deployed templates.

Finally, to test your template run:

```
e2b sandbox spawn TEMPLATENAME
cd project
```

You will see a URL in the form of `https://xxxxxxxxxxxxxxxxxxx.e2b.dev`.

Now, run the command to start your development server.

To see the running server, visit the public url `https://<PORT>-xxxxxxxxxxxxxxxxxxx.e2b.dev`.

If you've done this and it works, let us know and we'll add your template to GitWit! Please reach out to us [on Discord](https://discord.gitwit.dev/) with any questions or to submit your working template.

</details>

## Running Tests

To run the test suite, ensure both web app and server are running.

First, install dependencies in the test directory:

```bash
cd tests
npm install
```

Set up the following environment variables in the test directory:

```
GITHUB_PAT=ghp_xxxxxxxxxxxxxxxxxxxxxx
CLERK_TEST_USER_ID=user_xxxxxxxxxxxxxxxxxxxxxx
```

**Note:** The `CLERK_TEST_USER_ID` should match the user ID that was used to sign up and is stored in your PostgreSQL database. You can find this ID in your database's users table or from your Clerk dashboard.

Make sure both web app and server are running, then execute:

```bash
npm run test
```

## Deployment

The backend server and deployments server can be deployed using AWS's EC2 service. See [our video guide](https://www.youtube.com/watch?v=WN8HQnimjmk) on how to do this.

## Contributing

Thanks for your interest in contributing! Review this section before submitting your first pull request. If you need any help, feel free contact us [on Discord](https://discord.gitwit.dev/).

### Code formatting

This repository uses [Prettier](https://marketplace.cursorapi.com/items?itemName=esbenp.prettier-vscode) for code formatting, which you will be prompted to install when you open the project. The formatting rules are specified in [.prettierrc](.prettierrc).

### Commit convention

When commiting, please use the [Conventional Commits format](https://www.conventionalcommits.org/en/v1.0.0/). Your commit should be in the form `category: message` using the following categories:

| Type       | Description                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------- |
| `feat`     | All changes that introduce completely new code or new features                               |
| `fix`      | Changes that fix a bug (ideally with a reference to an issue if present)                     |
| `refactor` | Any code-related change that is not a fix nor a feature                                      |
| `docs`     | Changing existing or creating new documentation (e.g., README, usage docs, CLI usage guides) |
| `chore`    | All changes to the repository that do not fit into any of the above categories               |
