import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">
                AI Game Narrative Generator
              </h1>
            </div>
            <nav className="flex space-x-8">
              <Link href="/projects" className="text-gray-600 hover:text-gray-900">
                Projects
              </Link>
              <Link href="/docs" className="text-gray-600 hover:text-gray-900">
                Documentation
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Dynamic AI-driven worlds where CrewAI agents collaborate to create branching storylines, quests, and dialogue
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Generate interactive narrative content for games using multiple AI agents that work together to create compelling stories, quests, and character dialogues.
          </p>
          <div className="flex justify-center space-x-4">
            <Link href="/projects/new" className="btn-primary">
              Create New Project
            </Link>
            <Link href="/demo" className="btn-secondary">
              View Demo
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Story Architect</h3>
            <p className="text-gray-600">
              Creates branching story arcs and pacing with meaningful player choices and emotional impact.
            </p>
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Quest Designer</h3>
            <p className="text-gray-600">
              Designs quest structures with conditions, rewards, and outcomes that integrate seamlessly with the story.
            </p>
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Dialogue Writer</h3>
            <p className="text-gray-600">
              Generates NPC dialogue trees with emotion and tone that adapt to quest state and player choices.
            </p>
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Lore Keeper</h3>
            <p className="text-gray-600">
              Enforces canon consistency and validates new content against established lore and world rules.
            </p>
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Simulator</h3>
            <p className="text-gray-600">
              Simulates player choices and tracks reputation changes to influence subsequent content generation.
            </p>
          </div>
          
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Exporter</h3>
            <p className="text-gray-600">
              Packages content for game engines in multiple formats including JSON, YAML, PDF, and HTML.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
