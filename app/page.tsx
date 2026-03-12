cat > /workspaces/twonest-2nest-/app/page.tsx << 'EOF'
export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8 text-center" style={{backgroundColor: '#f0f7ff'}}>
      <h1 className="text-4xl font-bold mb-4" style={{color: '#4A90D9'}}>2nest 🪺</h1>
      <p className="text-xl mb-8 text-gray-600">La co-parentalité sans le chaos</p>
      <div className="space-x-4">
        <a href="/login" className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600">
          Se connecter
        </a>
        <a href="/signup" className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600">
          S'inscrire
        </a>
      </div>
    </div>
  )
}
EOF