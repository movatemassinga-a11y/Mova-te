import React, { useState } from 'react';

// Simulação de autenticação para destravar o app
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'client' | 'driver' | 'admin'>('client');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // LOGICA DE DESTRAVAMENTO: Se for Shadowwalker ou Admin selecionado, ele entra direto!
    if (username.toLowerCase() === 'shadowwalker' || userRole === 'admin') {
      setIsAuthenticated(true);
      alert('Bem-vindo ao painel de controle, Shadowwalker!');
    } else {
      setIsAuthenticated(true);
      setUserRole('client');
    }
  };

  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 p-8 flex flex-col items-center justify-center font-sans">
        <h1 className="text-3xl font-bold text-blue-900 mb-4">Mova-te Massinga</h1>
        <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md text-center">
          <p className="text-xl mb-4">Olá, <strong>{username || 'Utilizador'}</strong>!</p>
          <div className="bg-green-100 text-green-800 p-3 rounded mb-6">
            Acesso {userRole.toUpperCase()} confirmado com sucesso.
          </div>
          <button 
            onClick={() => setIsAuthenticated(false)}
            className="bg-red-500 text-white px-4 py-2 rounded-lg"
          >
            Sair do Sistema
          </button>
        </div>
        <p className="mt-8 text-gray-500">O mapa será carregado assim que a API Key for validada.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-600 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚀</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Mova-te Massinga</h2>
          <p className="text-gray-500">Faça login para continuar</p>
        </div>

        <div className="flex justify-around mb-6 border-b">
          {['client', 'driver', 'admin'].map((role) => (
            <button
              key={role}
              onClick={() => setUserRole(role as any)}
              className={`pb-2 px-2 capitalize ${userRole === role ? 'border-b-2 border-blue-600 text-blue-600 font-bold' : 'text-gray-400'}`}
            >
              {role === 'client' ? 'Cliente' : role === 'driver' ? 'Motorista' : 'Admin'}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Usuário</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-blue-500 focus:border-blue-600"
              placeholder="Ex: Shadowwalker"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Senha / Chave Admin</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full border border-gray-300 rounded-md p-2 shadow-sm focus:ring-blue-500 focus:border-blue-600"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-yellow-500 hover:bg-yellow-600 text-blue-900 font-bold py-3 rounded-lg transition-colors"
          >
            Entrar no Mova-te
          </button>
        </form>
      </div>
    </div>
  );
}
