export interface TemplateConfig {
  id: string
  name: string
  runCommand: string
  conventions: string[]
  dependencies?: {
    [key: string]: string
  }
  scripts?: {
    [key: string]: string
  }
}

export const templateConfigs: { [key: string]: TemplateConfig } = {
  reactjs: {
    id: "reactjs",
    name: "React",
    runCommand: "npm run dev",
    conventions: [
      "Use functional components with hooks",
      "Follow React naming conventions (PascalCase for components)",
      "Keep components small and focused",
      "Use TypeScript for type safety",
    ],
    dependencies: {
      "@radix-ui/react-icons": "^1.3.0",
      "@radix-ui/react-slot": "^1.1.0",
      "class-variance-authority": "^0.7.0",
      clsx: "^2.1.1",
      "lucide-react": "^0.441.0",
      react: "^18.3.1",
      "react-dom": "^18.3.1",
      "tailwind-merge": "^2.5.2",
      "tailwindcss-animate": "^1.0.7",
    },
    scripts: {
      dev: "vite",
      build: "tsc && vite build",
      preview: "vite preview",
    },
  },
  // Next.js template config
  nextjs: {
    id: "nextjs",
    name: "NextJS",
    runCommand: "npm run dev",
    conventions: [
      "Use file-system based routing",
      "Keep API routes in pages/api",
      "Use CSS Modules for component styles",
      "Follow Next.js data fetching patterns",
    ],
    dependencies: {
      next: "^14.1.0",
      react: "^18.2.0",
      "react-dom": "18.2.0",
      tailwindcss: "^3.4.1",
    },
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
    },
  },
  // Streamlit template config
  streamlit: {
    id: "streamlit",
    name: "Streamlit",
    runCommand: "./venv/bin/streamlit run main.py --server.runOnSave true",
    conventions: [
      "Use Streamlit components for UI",
      "Follow PEP 8 style guide",
      "Keep dependencies in requirements.txt",
      "Use virtual environment for isolation",
    ],
    dependencies: {
      streamlit: "^1.40.0",
      altair: "^5.5.0",
    },
    scripts: {
      start: "streamlit run main.py",
      dev: "./venv/bin/streamlit run main.py --server.runOnSave true",
    },
  },
  // HTML template config
  vanillajs: {
    id: "vanillajs",
    name: "HTML/JS",
    runCommand: "npm run dev",
    conventions: [
      "Use semantic HTML elements",
      "Keep CSS modular and organized",
      "Write clean, modular JavaScript",
      "Follow modern ES6+ practices",
    ],
    dependencies: {
      vite: "^5.0.12",
    },
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
  },
  // PHP template config
  php: {
    id: "php",
    name: "PHP",
    runCommand: "npx vite",
    conventions: [
      "Follow PSR-12 coding standards",
      "Use modern PHP 8+ features",
      "Organize assets with Vite",
      "Keep PHP logic separate from presentation",
    ],
    dependencies: {
      vite: "^5.0.0",
    },
    scripts: {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    },
  },
}

export const projectTemplates: {
  id: string
  name: string
  icon: string
  description: string
  disabled: boolean
}[] = [
  {
    id: "reactjs",
    name: "React",
    icon: "/project-icons/react.svg",
    description: "A JavaScript library for building user interfaces",
    disabled: false,
  },
  {
    id: "vanillajs",
    name: "HTML/JS",
    icon: "/project-icons/more.svg",
    description: "A simple HTML/JS project for building web apps",
    disabled: false,
  },
  {
    id: "nextjs",
    name: "NextJS",
    icon: "/project-icons/next-js.svg",
    description: "a React framework for building full-stack web applications",
    disabled: false,
  },
  {
    id: "streamlit",
    name: "Streamlit",
    icon: "/project-icons/python.svg",
    description: "A faster way to build and share data apps",
    disabled: false,
  },
  {
    id: "php",
    name: "PHP",
    description: "PHP development environment",
    icon: "/project-icons/php.svg",
    disabled: false,
  },
]
