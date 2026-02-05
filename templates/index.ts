export interface TemplateConfig {
  id: string
  name: string
  runCommand: string
  conventions: string[]
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
  },
  // Empty template - no files, blank slate
  empty: {
    id: "empty",
    name: "Empty",
    runCommand:
      'echo "Empty project - add your files to get started" && sleep infinity',
    conventions: [
      "Start from scratch with no pre-existing files",
      "Add whatever you need - Node.js and npm are available",
    ],
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
  {
    id: "empty",
    name: "Empty",
    icon: "/project-icons/more.svg",
    description: "A blank slate with no pre-existing files",
    disabled: false,
  },
]
