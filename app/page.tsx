export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="border-b border-purple-500/20 bg-slate-900/50 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Mohammed Hamiani</h1>
          <a
            href="/dashboard"
            className="text-purple-400 hover:text-purple-300 transition-colors text-sm font-medium"
          >
            Dashboard
          </a>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-20">
        <section className="mb-20">
          <h2 className="text-5xl font-bold text-white mb-6">Développeur Fullstack</h2>
          <p className="text-xl text-slate-300 mb-8 max-w-2xl">
            Bienvenue sur mon portfolio. Je suis en recherche active d'une opportunité de stage en développement web fullstack.
          </p>
          <a
            href="/dashboard"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg transition-colors"
          >
            Accéder au Dashboard
          </a>
        </section>

        <section className="grid md:grid-cols-3 gap-8">
          <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-3">🎓 Formation</h3>
            <p className="text-slate-400">Concepteur Développeur Fullstack</p>
          </div>
          <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-3">💻 Compétences</h3>
            <p className="text-slate-400">JavaScript, React, Node.js, Python, SQL</p>
          </div>
          <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-6">
            <h3 className="text-lg font-bold text-white mb-3">🚀 Projets</h3>
            <p className="text-slate-400">Fullstack, UI/UX, Web moderne</p>
          </div>
        </section>
      </main>
    </div>
  );
}
