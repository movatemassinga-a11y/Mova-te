import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  Navigation, 
  Car, 
  Bike, 
  Users, 
  Send, 
  LogOut, 
  AlertTriangle, 
  CheckCircle, 
  MessageSquare,
  Plus,
  Shield,
  Phone,
  Key,
  MapPin,
  DollarSign,
  ArrowLeft,
  X
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Driver, Ride, Message, Category, Offer } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const socket: Socket = io();

// Notification sound helper
const playNotificationSound = (type: 'new' | 'info' = 'info') => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'new') {
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5);
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } else {
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    }
  } catch (e) {
    console.log('Audio not supported or blocked');
  }
};

export default function App() {
  const [role, setRole] = useState<'client' | 'driver' | 'admin' | null>(null);
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<'login' | 'dashboard' | 'ride'>('login');
  const [showWelcome, setShowWelcome] = useState(true);
  const [rides, setRides] = useState<Ride[]>([]);
  const [currentRide, setCurrentRide] = useState<Ride | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'danger' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' | 'danger' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Persistence
  useEffect(() => {
    const savedRole = localStorage.getItem('movate_role');
    const savedUser = localStorage.getItem('movate_user');
    const savedRide = localStorage.getItem('movate_current_ride');
    
    if (savedRole && savedUser) {
      setRole(savedRole as any);
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      setView('dashboard');
      setShowWelcome(false);

      if (savedRide) {
        const parsedRide = JSON.parse(savedRide);
        setCurrentRide(parsedRide);
        setView('ride');
        // Fetch messages for current ride
        fetch(`/api/admin/messages/${parsedRide.id}`)
          .then(res => res.json())
          .then(data => setMessages(data));
      }
    }
  }, []);

  useEffect(() => {
    if (role) {
      localStorage.setItem('movate_role', role);
      localStorage.setItem('movate_user', JSON.stringify(user));
      if (currentRide) {
        localStorage.setItem('movate_current_ride', JSON.stringify(currentRide));
      } else {
        localStorage.removeItem('movate_current_ride');
      }
    } else {
      localStorage.removeItem('movate_role');
      localStorage.removeItem('movate_user');
      localStorage.removeItem('movate_current_ride');
    }
  }, [role, user, currentRide]);

  useEffect(() => {
    if (currentRide) {
      socket.emit('join_ride', { ride_id: currentRide.id });
    }
  }, [currentRide?.id]);

  useEffect(() => {
    if (role === 'driver' && user?.id) {
      fetch(`/api/driver/rides/${user.id}`)
        .then(res => res.json())
        .then(data => setRides(data));
    }
  }, [role, user?.id]);

  // Socket Listeners
  useEffect(() => {
    socket.on('new_ride_request', (ride: Ride) => {
      setRides(prev => {
        if (prev.some(r => r.id === ride.id)) return prev;
        return [ride, ...prev];
      });
      if (role === 'driver' && ride.category === user?.category) {
        playNotificationSound('new');
      }
    });

    socket.on('ride_created', (ride: Ride) => {
      setCurrentRide(ride);
    });

    socket.on('new_offer', (offer: Offer) => {
      if (currentRide?.id === offer.ride_id || (role === 'client' && view === 'waiting')) {
        setOffers(prev => {
          if (prev.some(o => o.id === offer.id)) return prev;
          return [...prev, offer];
        });
        if (role === 'client') {
          playNotificationSound('new');
        }
      }
    });

    socket.on('ride_accepted', (ride: Ride) => {
      setRides(prev => prev.map(r => r.id === ride.id ? ride : r));
      if (currentRide?.id === ride.id || (role === 'driver' && ride.driver_id === user?.id)) {
        setCurrentRide(ride);
        setView('ride');
        playNotificationSound();
      }
    });

    socket.on('ride_finished', ({ ride_id }) => {
      setRides(prev => prev.map(r => r.id === ride_id ? { ...r, status: 'finished' } : r));
      if (currentRide?.id === ride_id) {
        setCurrentRide(prev => prev ? { ...prev, status: 'finished' } : null);
        setTimeout(() => {
          setCurrentRide(null);
          setView('dashboard');
        }, 2000);
      }
    });

    socket.on('new_message', (msg: Message) => {
      if (currentRide?.id === msg.ride_id) {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });

    socket.on('ride_canceled', ({ ride_id }) => {
      setRides(prev => prev.filter(r => r.id !== ride_id));
      if (currentRide?.id === ride_id) {
        setCurrentRide(null);
        setView('dashboard');
        setOffers([]);
        showToast('O pedido foi cancelado pelo cliente.', 'info');
      }
    });

    socket.on('admin_danger_alert', ({ ride_id, driver_id }) => {
      if (role === 'admin') {
        showToast(`ALERTA DE PERIGO: Corrida #${ride_id} (Motorista ID: ${driver_id})`, 'danger');
      }
    });

    return () => {
      socket.off('new_ride_request');
      socket.off('ride_created');
      socket.off('new_offer');
      socket.off('ride_accepted');
      socket.off('ride_finished');
      socket.off('new_message');
      socket.off('ride_canceled');
      socket.off('admin_danger_alert');
    };
  }, [currentRide, role, user, view]);

  const handleLogout = () => {
    if (role === 'client' && currentRide && currentRide.status === 'pending') {
      socket.emit('cancel_ride', { ride_id: currentRide.id });
    }
    setRole(null);
    setUser(null);
    setView('login');
    setCurrentRide(null);
    setOffers([]);
  };

  if (showWelcome && !role) {
    return <WelcomeScreen onFinish={() => setShowWelcome(false)} />;
  }

  if (view === 'login' && !role) {
    return <LoginScreen setRole={setRole} setUser={setUser} setView={setView} onBack={() => setShowWelcome(true)} />;
  }

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-white shadow-xl relative">
      {/* Header */}
      <header className="bg-primary pt-[calc(env(safe-area-inset-top)+1rem)] pb-4 px-4 flex items-center justify-between text-white sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {role && (
            <button onClick={handleLogout} className="mr-2 p-1 hover:bg-white/10 rounded-full transition-colors flex items-center gap-1">
              <ArrowLeft size={20} />
              <span className="text-xs font-bold uppercase hidden sm:inline">Voltar</span>
            </button>
          )}
          <Navigation className="text-secondary fill-secondary" size={28} />
          <h1 className="font-bold text-xl tracking-tight">Mova-te</h1>
        </div>
        <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <LogOut size={20} />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 pb-24">
        {role === 'client' && (
          <ClientDashboard 
            view={view} 
            setView={setView} 
            currentRide={currentRide} 
            setCurrentRide={setCurrentRide}
            offers={offers}
            setOffers={setOffers}
            messages={messages}
            setMessages={setMessages}
            showToast={showToast}
            setConfirmModal={setConfirmModal}
          />
        )}
        {role === 'driver' && (
          <DriverDashboard 
            driver={user} 
            rides={rides} 
            setRides={setRides}
            currentRide={currentRide}
            setCurrentRide={setCurrentRide}
            messages={messages}
            setMessages={setMessages}
            showToast={showToast}
            setConfirmModal={setConfirmModal}
          />
        )}
        {role === 'admin' && (
          <AdminDashboard showToast={showToast} />
        )}
      </main>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-4 right-4 z-[100] animate-in slide-in-from-top-10 duration-300">
          <div className={cn(
            "p-4 rounded-2xl shadow-2xl border flex items-center gap-3",
            toast.type === 'success' ? "bg-green-500 border-green-600 text-white" :
            toast.type === 'error' ? "bg-red-500 border-red-600 text-white" :
            toast.type === 'danger' ? "bg-red-600 border-red-700 text-white animate-pulse" :
            "bg-primary border-primary/20 text-white"
          )}>
            {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
            <p className="text-sm font-bold">{toast.message}</p>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-primary mb-2">{confirmModal.title}</h3>
            <p className="text-slate-500 text-sm mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmModal(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl active:scale-95 transition-all"
              >
                Não
              </button>
              <button 
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl shadow-lg shadow-red-500/20 active:scale-95 transition-all"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function WelcomeScreen({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="min-h-screen max-w-md mx-auto bg-primary flex flex-col items-center justify-between p-8 text-white relative overflow-hidden">
      {/* Background Decorative Circles */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-secondary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />

      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="bg-white p-6 rounded-[40px] shadow-2xl shadow-black/20 rotate-3 hover:rotate-0 transition-transform duration-500">
          <Navigation className="text-primary fill-primary" size={80} />
        </div>
        
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tighter">Mova-te</h1>
          <p className="text-white/60 font-medium text-lg">Massinga na palma da mão</p>
        </div>

        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-6 w-full max-w-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="bg-secondary p-2 rounded-xl">
              <Plus className="text-white" size={20} />
            </div>
            <p className="text-left text-xs font-bold leading-tight">
              Dica: Salve o app na sua tela inicial para acesso rápido!
            </p>
          </div>
          <div className="flex justify-center gap-4 text-[10px] text-white/40 font-bold uppercase tracking-widest">
            <span>Menu</span>
            <span>•</span>
            <span>Adicionar à tela inicial</span>
          </div>
        </div>
      </div>

      <div className="w-full space-y-4 animate-in slide-in-from-bottom-10 duration-700 delay-300 fill-mode-both">
        <button 
          onClick={onFinish}
          className="w-full bg-secondary text-white font-black py-5 rounded-2xl shadow-xl shadow-secondary/20 active:scale-95 transition-all text-lg"
        >
          Começar Agora
        </button>
        <p className="text-center text-[10px] text-white/40 font-bold uppercase tracking-widest">
          © 2024 Mova-te Massinga
        </p>
      </div>
    </div>
  );
}

function LoginScreen({ setRole, setUser, setView, onBack }: any) {
  const [loginType, setLoginType] = useState<'client' | 'driver' | 'admin'>('client');
  const [formData, setFormData] = useState({ phone: '', key: '', username: '', password: '' });
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (loginType === 'client') {
      setRole('client');
      setUser({ name: formData.username || 'Cliente' });
      setView('dashboard');
    } else if (loginType === 'admin') {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: formData.username, password: formData.password })
      });
      const data = await res.json();
      if (data.success) {
        setRole('admin');
        setUser({ name: 'Shadowalker' });
        setView('dashboard');
      } else {
        setError(data.message);
      }
    } else {
      const res = await fetch('/api/driver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formData.phone, access_key: formData.key })
      });
      const data = await res.json();
      if (data.success) {
        setRole('driver');
        setUser(data.driver);
        setView('dashboard');
      } else {
        setError(data.message);
      }
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-6 relative">
      <button 
        onClick={onBack}
        className="absolute top-[calc(env(safe-area-inset-top)+1.5rem)] left-8 text-white/60 hover:text-white flex items-center gap-2 text-sm font-bold transition-colors"
      >
        <ArrowLeft size={20} /> Voltar
      </button>
      
      <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-secondary/10 p-4 rounded-full mb-4">
            <Navigation className="text-secondary fill-secondary" size={48} />
          </div>
          <h1 className="text-3xl font-bold text-primary">Mova-te</h1>
          <p className="text-slate-500 text-sm">Massinga</p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl mb-6">
          {(['client', 'driver', 'admin'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setLoginType(t)}
              className={cn(
                "flex-1 py-2 text-sm font-medium rounded-lg transition-all capitalize",
                loginType === t ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t === 'client' ? 'Cliente' : t === 'driver' ? 'Motorista' : 'Admin'}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {loginType === 'client' && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Seu Nome</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Ex: João Silva"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
            </div>
          )}

          {loginType === 'driver' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Telefone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="tel"
                    placeholder="84xxxxxxx"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Chave de Acesso</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    placeholder="••••••"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    value={formData.key}
                    onChange={e => setFormData({ ...formData, key: e.target.value })}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {loginType === 'admin' && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Usuário</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Shadowalker"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    value={formData.username}
                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase ml-1">Chave Admin</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="password"
                    placeholder="••••••"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    required
                  />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-red-500 text-xs text-center font-medium">{error}</p>}

          <button
            type="submit"
            className="w-full bg-secondary text-white font-bold py-4 rounded-xl shadow-lg shadow-secondary/30 hover:bg-secondary/90 active:scale-95 transition-all mt-4"
          >
            Entrar no Mova-te
          </button>
        </form>
      </div>
    </div>
  );
}

function ClientDashboard({ view, setView, currentRide, setCurrentRide, offers, setOffers, messages, setMessages, showToast, setConfirmModal }: any) {
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [category, setCategory] = useState<Category>('Moto');
  const [history, setHistory] = useState<Ride[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [searchMessageIndex, setSearchMessageIndex] = useState(0);

  const searchingMessages = [
    "Localizando motoristas próximos...",
    "Enviando seu pedido para a rede...",
    "Aguardando a melhor oferta para você...",
    "Quase lá! Motoristas estão visualizando...",
    "Verificando disponibilidade na Massinga..."
  ];

  useEffect(() => {
    if (view === 'waiting') {
      const interval = setInterval(() => {
        setSearchMessageIndex((prev) => (prev + 1) % searchingMessages.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [view]);

  const clientName = JSON.parse(localStorage.getItem('movate_user') || '{}').name;

  useEffect(() => {
    if (showHistory) {
      fetch(`/api/client/rides/${clientName}`)
        .then(res => res.json())
        .then(data => setHistory(data));
    }
  }, [showHistory, clientName]);

  const requestRide = () => {
    if (!pickup || !destination) return;
    const user = JSON.parse(localStorage.getItem('movate_user') || '{}');
    const rideData = {
      client_name: user.name,
      client_phone: user.phone,
      pickup,
      destination,
      category
    };
    socket.emit('request_ride', rideData);
    setOffers([]);
    setView('waiting');
  };

  const cancelRide = () => {
    if (currentRide) {
      socket.emit('cancel_ride', { ride_id: currentRide.id });
    }
    setView('dashboard');
    setCurrentRide(null);
    setOffers([]);
  };

  const acceptOffer = (offerId: number) => {
    if (currentRide) {
      socket.emit('client_accept', { ride_id: currentRide.id, offer_id: offerId });
    }
  };

  if (currentRide && (currentRide.status === 'accepted' || currentRide.status === 'finished')) {
    return <RideScreen ride={currentRide} role="client" messages={messages} showToast={showToast} setConfirmModal={setConfirmModal} />;
  }

  if (view === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8 py-8">
        <div className="relative flex items-center justify-center">
          {/* Radar Circles */}
          <div className="absolute w-64 h-64 bg-secondary/5 rounded-full animate-[ping_3s_linear_infinite]" />
          <div className="absolute w-48 h-48 bg-secondary/10 rounded-full animate-[ping_2s_linear_infinite]" />
          <div className="absolute w-32 h-32 bg-secondary/20 rounded-full animate-[ping_1.5s_linear_infinite]" />
          
          <div className="relative bg-secondary p-8 rounded-full text-white shadow-2xl z-10 transform transition-transform hover:scale-110">
            {category === 'Moto' ? <Bike size={56} className="animate-bounce" /> : 
             category === 'Txopela' ? <Navigation size={56} className="animate-pulse" /> : 
             <Car size={56} className="animate-bounce" />}
          </div>
        </div>

        <div className="text-center space-y-2 px-4">
          <h2 className="text-2xl font-black text-primary tracking-tight">Buscando {category}</h2>
          <div className="h-6 flex items-center justify-center">
            <p className="text-slate-500 text-sm font-medium animate-in fade-in slide-in-from-bottom-2 duration-500" key={searchMessageIndex}>
              {searchingMessages[searchMessageIndex]}
            </p>
          </div>
          <div className="flex justify-center gap-1 mt-4">
            <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:-0.3s]" />
            <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce [animation-delay:-0.15s]" />
            <div className="w-1.5 h-1.5 bg-secondary rounded-full animate-bounce" />
          </div>
        </div>

        <div className="w-full space-y-4 px-2">
          {offers.length > 0 && (
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-slate-100" />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ofertas Recebidas</span>
              <div className="h-px flex-1 bg-slate-100" />
            </div>
          )}
          {offers.map((offer: Offer) => (
            <div key={offer.id} className="w-full bg-white border-2 border-secondary/20 rounded-3xl p-5 shadow-xl hover:border-secondary transition-all group animate-in zoom-in-95 duration-300">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 p-3 rounded-2xl group-hover:bg-secondary/10 transition-colors">
                    {offer.driver_category === 'Moto' ? <Bike size={24} className="text-slate-600 group-hover:text-secondary" /> : 
                     offer.driver_category === 'Txopela' ? <Navigation size={24} className="text-slate-600 group-hover:text-secondary" /> : 
                     <Car size={24} className="text-slate-600 group-hover:text-secondary" />}
                  </div>
                  <div>
                    <span className="text-xs font-black text-primary uppercase tracking-tight">{offer.driver_name}</span>
                    <p className="text-[10px] text-slate-400 font-medium">Motorista Verificado</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Preço</p>
                  <span className="text-xl font-black text-secondary">MT {offer.price}</span>
                </div>
              </div>
              <button 
                onClick={() => acceptOffer(offer.id)}
                className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                Aceitar Esta Oferta
              </button>
            </div>
          ))}
        </div>

        <button 
          onClick={cancelRide}
          className="px-6 py-2 rounded-full text-slate-400 text-xs font-bold uppercase tracking-widest hover:bg-red-50 hover:text-red-500 transition-all"
        >
          Cancelar Pedido
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          {showHistory && (
            <button onClick={() => setShowHistory(false)} className="p-2 bg-slate-100 rounded-full text-primary">
              <ArrowLeft size={16} />
            </button>
          )}
          <h2 className="text-xl font-bold text-primary">
            {showHistory ? 'Meu Histórico' : 'Para onde vamos?'}
          </h2>
        </div>
        {!showHistory && (
          <button 
            onClick={() => setShowHistory(true)}
            className="text-xs font-bold text-secondary uppercase bg-secondary/10 px-3 py-1 rounded-full"
          >
            Ver Histórico
          </button>
        )}
      </div>
      
      {showHistory ? (
        <div className="space-y-3">
          {history.length === 0 ? (
            <p className="text-center text-slate-400 py-10">Nenhuma corrida encontrada.</p>
          ) : (
            history.map(ride => (
              <div key={ride.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(ride.created_at).toLocaleDateString()}</span>
                  <span className={cn(
                    "text-[8px] font-black px-2 py-1 rounded uppercase",
                    ride.status === 'finished' ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
                  )}>{ride.status}</span>
                </div>
                <div className="space-y-1 mb-3">
                  <p className="text-sm font-bold text-primary truncate">{ride.pickup} → {ride.destination}</p>
                  <p className="text-xs text-slate-500">Motorista: {ride.driver_name || 'N/A'} • {ride.category}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                  <span className="text-xs font-bold text-secondary">MT {ride.final_price || 0}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 flex flex-col items-center py-4">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <div className="w-0.5 flex-1 bg-slate-200 my-1" />
                  <div className="w-2 h-2 rounded-full bg-secondary" />
                </div>
                
                <div className="ml-10 space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Partida</label>
                    <input
                      type="text"
                      placeholder="Onde você está?"
                      className="w-full py-2 bg-transparent border-b border-slate-100 focus:border-primary focus:outline-none transition-colors"
                      value={pickup}
                      onChange={e => setPickup(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Destino</label>
                    <input
                      type="text"
                      placeholder="Para onde quer ir?"
                      className="w-full py-2 bg-transparent border-b border-slate-100 focus:border-secondary focus:outline-none transition-colors"
                      value={destination}
                      onChange={e => setDestination(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {(['Moto', 'Txopela', 'Taxi'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  "flex flex-col items-center p-4 rounded-2xl border-2 transition-all",
                  category === cat 
                    ? "bg-primary/5 border-primary text-primary" 
                    : "bg-white border-slate-100 text-slate-400 hover:border-slate-200"
                )}
              >
                {cat === 'Moto' ? <Bike size={24} /> : cat === 'Txopela' ? <Navigation size={24} /> : <Car size={24} />}
                <span className="text-xs font-bold mt-2">{cat}</span>
              </button>
            ))}
          </div>

          <button
            onClick={requestRide}
            disabled={!pickup || !destination}
            className="w-full bg-secondary text-white font-bold py-5 rounded-2xl shadow-xl shadow-secondary/20 disabled:opacity-50 disabled:shadow-none active:scale-95 transition-all"
          >
            Solicitar {category}
          </button>
        </>
      )}
    </div>
  );
}

function DriverDashboard({ driver, rides, setRides, currentRide, setCurrentRide, messages, setMessages, showToast, setConfirmModal }: any) {
  const [offerPrice, setOfferPrice] = useState('');
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [history, setHistory] = useState<Ride[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [dismissedRideIds, setDismissedRideIds] = useState<number[]>([]);

  useEffect(() => {
    if (showHistory) {
      fetch(`/api/driver/rides/${driver.id}`)
        .then(res => res.json())
        .then(data => setHistory(data));
    }
  }, [showHistory, driver.id]);

  const filteredRides = rides.filter(r => 
    r.category === driver.category && 
    r.status === 'pending' && 
    !dismissedRideIds.includes(r.id)
  );

  const dismissRide = (rideId: number) => {
    setDismissedRideIds(prev => [...prev, rideId]);
  };

  const sendOffer = (rideId: number) => {
    if (!offerPrice) return;
    socket.emit('driver_offer', { ride_id: rideId, driver_id: driver.id, price: parseFloat(offerPrice) });
    setOfferPrice('');
    setSelectedRide(null);
  };

  if (currentRide && (currentRide.status === 'accepted' || currentRide.status === 'finished')) {
    return <RideScreen ride={currentRide} role="driver" messages={messages} showToast={showToast} setConfirmModal={setConfirmModal} />;
  }

  return (
    <div className="space-y-4">
      <div className="bg-primary rounded-3xl p-6 text-white shadow-lg">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            {showHistory && (
              <button onClick={() => setShowHistory(false)} className="p-2 bg-white/10 rounded-full text-white">
                <ArrowLeft size={16} />
              </button>
            )}
            <div>
              <p className="text-white/60 text-xs font-bold uppercase tracking-wider">Bem-vindo,</p>
              <h2 className="text-2xl font-bold">{driver.name}</h2>
            </div>
          </div>
          <div className="bg-white/10 p-2 rounded-xl">
            {driver.category === 'Moto' ? <Bike size={24} /> : driver.category === 'Txopela' ? <Navigation size={24} /> : <Car size={24} />}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-medium text-white/80">Online • {driver.category}</span>
          </div>
          {!showHistory && (
            <button 
              onClick={() => setShowHistory(true)}
              className="text-[10px] font-bold uppercase bg-white/10 px-3 py-1 rounded-full"
            >
              Meu Histórico
            </button>
          )}
        </div>
      </div>

      {showHistory ? (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-2">Histórico de Corridas</h3>
          {history.length === 0 ? (
            <p className="text-center text-slate-400 py-10">Nenhuma corrida encontrada.</p>
          ) : (
            history.map(ride => (
              <div key={ride.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{new Date(ride.created_at).toLocaleDateString()}</span>
                  <span className={cn(
                    "text-[8px] font-black px-2 py-1 rounded uppercase",
                    ride.status === 'finished' ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-500"
                  )}>{ride.status}</span>
                </div>
                <div className="space-y-1 mb-2">
                  <p className="text-sm font-bold text-primary">{ride.client_name}</p>
                  <p className="text-xs text-slate-600 truncate">{ride.pickup} → {ride.destination}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                  <span className="text-xs font-bold text-secondary">MT {ride.final_price || 0}</span>
                  <span className="text-[10px] text-slate-400">Comissão: MT {ride.admin_fee?.toFixed(2) || 0}</span>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest ml-2">Solicitações Disponíveis</h3>

          {filteredRides.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
              <p className="text-slate-400 text-sm">Aguardando novas solicitações...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRides.map((ride) => (
                <div key={ride.id} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-slate-100 p-2 rounded-full">
                        <Users size={18} className="text-slate-500" />
                      </div>
                      <div>
                        <p className="font-bold text-primary">{ride.client_name}</p>
                        <p className="text-[10px] text-slate-400">Solicitado agora</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="bg-secondary/10 text-secondary text-[10px] font-black px-2 py-1 rounded-md uppercase">
                        {ride.category}
                      </span>
                      <button 
                        onClick={() => dismissRide(ride.id)}
                        className="p-1.5 bg-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Ignorar solicitação"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 mb-5">
                    <div className="flex items-center gap-3">
                      <MapPin size={14} className="text-primary" />
                      <p className="text-sm text-slate-600 truncate">{ride.pickup}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <MapPin size={14} className="text-secondary" />
                      <p className="text-sm text-slate-600 truncate">{ride.destination}</p>
                    </div>
                  </div>

                  {selectedRide?.id === ride.id ? (
                    <div className="flex gap-2 animate-in fade-in slide-in-from-top-2">
                      <input
                        type="number"
                        placeholder="Valor MT"
                        className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
                        value={offerPrice}
                        onChange={e => setOfferPrice(e.target.value)}
                        autoFocus
                      />
                      <button 
                        onClick={() => sendOffer(ride.id)}
                        className="bg-primary text-white p-3 rounded-xl shadow-lg shadow-primary/20"
                      >
                        <Send size={20} />
                      </button>
                      <button 
                        onClick={() => setSelectedRide(null)}
                        className="bg-slate-100 text-slate-400 p-3 rounded-xl"
                      >
                        X
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSelectedRide(ride)}
                      className="w-full bg-primary text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/10 hover:bg-primary/90 transition-all"
                    >
                      Fazer Oferta
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RideScreen({ ride, role, messages, showToast, setConfirmModal }: { 
  ride: Ride, 
  role: 'client' | 'driver', 
  messages: Message[],
  showToast: (m: string, t?: any) => void,
  setConfirmModal: (c: any) => void
}) {
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault();
    const messageText = customText || text;
    if (!messageText.trim()) return;
    socket.emit('send_message', { ride_id: ride.id, sender_role: role, text: messageText });
    if (!customText) setText('');
  };

  const quickReplies = [
    "Estou a chegar",
    "Onde estás?",
    "OK",
    "Já cheguei",
    "Estou no local"
  ];

  const otherPersonPhone = role === 'client' ? ride.driver_phone : ride.client_phone;

  const finishRide = () => {
    socket.emit('finish_ride', { ride_id: ride.id });
  };

  const reportDanger = () => {
    setConfirmModal({
      title: 'Alerta de Perigo',
      message: 'Deseja alertar o administrador sobre um perigo?',
      onConfirm: () => {
        socket.emit('report_danger', { ride_id: ride.id, driver_id: ride.driver_id });
        showToast('Alerta enviado ao administrador!', 'danger');
      }
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">
      {/* Ride Info Card */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary">
              {role === 'client' ? <Car size={16} /> : <Users size={16} />}
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Em Corrida com</p>
              <p className="font-bold text-primary">{role === 'client' ? (ride.driver_name || 'Motorista') : ride.client_name}</p>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none">Valor</p>
            <p className="text-lg font-black text-secondary">MT {ride.final_price}</p>
            {otherPersonPhone && (
              <a 
                href={`tel:${otherPersonPhone}`}
                className="flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-full text-[10px] font-bold"
              >
                <Phone size={10} /> Ligar
              </a>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 mt-2">
          {role === 'driver' && (
            <>
              <button 
                onClick={finishRide}
                className="flex items-center justify-center gap-2 bg-green-500 text-white py-2 rounded-lg text-xs font-bold shadow-lg shadow-green-500/20"
              >
                <CheckCircle size={14} /> Terminar
              </button>
              <button 
                onClick={reportDanger}
                className="flex items-center justify-center gap-2 bg-red-500 text-white py-2 rounded-lg text-xs font-bold shadow-lg shadow-red-500/20"
              >
                <AlertTriangle size={14} /> Perigo
              </button>
            </>
          )}
          {ride.status === 'finished' && (
            <div className="col-span-2 bg-green-50 text-green-600 py-2 rounded-lg text-center text-xs font-bold border border-green-100">
              Corrida Finalizada com Sucesso!
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-slate-50 rounded-3xl p-4 overflow-hidden flex flex-col border border-slate-100">
        <div className="flex items-center gap-2 mb-4 px-2">
          <MessageSquare size={14} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mensagens</span>
        </div>
        
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-2">
          {messages.length === 0 && (
            <div className="h-full flex items-center justify-center">
              <p className="text-slate-300 text-[10px] font-medium uppercase">Nenhuma mensagem ainda</p>
            </div>
          )}
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={cn(
                "flex flex-col max-w-[80%]",
                msg.sender_role === role ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className={cn(
                "px-4 py-2 rounded-2xl text-sm shadow-sm",
                msg.sender_role === role 
                  ? "bg-primary text-white rounded-tr-none" 
                  : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
              )}>
                {msg.text}
              </div>
              <span className="text-[8px] text-slate-400 mt-1 px-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto py-2 no-scrollbar">
          {quickReplies.map((reply, i) => (
            <button
              key={i}
              onClick={() => sendMessage(undefined, reply)}
              className="whitespace-nowrap bg-white border border-slate-200 text-slate-500 text-[10px] font-bold px-3 py-1.5 rounded-full hover:bg-slate-50 active:scale-95 transition-all"
            >
              {reply}
            </button>
          ))}
        </div>

        <form onSubmit={sendMessage} className="mt-2 flex gap-2">
          <input
            type="text"
            placeholder="Escreva uma mensagem..."
            className="flex-1 bg-white px-4 py-3 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <button 
            type="submit"
            className="bg-secondary text-white p-3 rounded-xl shadow-lg shadow-secondary/20 active:scale-90 transition-all"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminDashboard({ showToast }: { showToast: (m: string, t?: any) => void }) {
  const [activeTab, setActiveTab] = useState<'rides' | 'drivers' | 'register'>('rides');
  const [rides, setRides] = useState<Ride[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [newDriver, setNewDriver] = useState({ name: '', phone: '', key: '', category: 'Moto' as Category });
  const [selectedRideMessages, setSelectedRideMessages] = useState<{rideId: number, messages: Message[]} | null>(null);

  const [selectedRideOffers, setSelectedRideOffers] = useState<{rideId: number, offers: Offer[]} | null>(null);
  const [selectedDriverRides, setSelectedDriverRides] = useState<{driverName: string, rides: Ride[]} | null>(null);

  const fetchData = async () => {
    const [ridesRes, driversRes] = await Promise.all([
      fetch('/api/admin/rides'),
      fetch('/api/admin/drivers')
    ]);
    setRides(await ridesRes.json());
    setDrivers(await driversRes.json());
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const registerDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/admin/drivers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newDriver, access_key: newDriver.key })
    });
    if (res.ok) {
      showToast('Motorista registrado com sucesso!', 'success');
      setNewDriver({ name: '', phone: '', key: '', category: 'Moto' });
      fetchData();
    } else {
      showToast('Erro ao registrar motorista.', 'error');
    }
  };

  const viewMessages = async (rideId: number) => {
    const res = await fetch(`/api/admin/messages/${rideId}`);
    const data = await res.json();
    setSelectedRideMessages({ rideId, messages: data });
  };

  const viewOffers = async (rideId: number) => {
    const res = await fetch(`/api/admin/offers/${rideId}`);
    const data = await res.json();
    setSelectedRideOffers({ rideId, offers: data });
  };

  const viewDriverRides = async (driver: Driver) => {
    const res = await fetch(`/api/admin/driver-rides/${driver.id}`);
    const data = await res.json();
    setSelectedDriverRides({ driverName: driver.name, rides: data });
  };

  const totalCommission = rides.reduce((acc, r) => acc + (r.admin_fee || 0), 0);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold">Painel Admin</h2>
          </div>
          <Shield className="text-secondary" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-white/40 text-[10px] font-bold uppercase">Ganhos Totais (10%)</p>
            <p className="text-2xl font-black text-secondary">MT {totalCommission.toFixed(2)}</p>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-white/40 text-[10px] font-bold uppercase">Motoristas</p>
            <p className="text-2xl font-black text-white">{drivers.length}</p>
          </div>
        </div>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-xl">
        {(['rides', 'drivers', 'register'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              "flex-1 py-2 text-xs font-bold rounded-lg transition-all capitalize",
              activeTab === t ? "bg-white text-primary shadow-sm" : "text-slate-500"
            )}
          >
            {t === 'rides' ? 'Corridas' : t === 'drivers' ? 'Motoristas' : 'Novo Motorista'}
          </button>
        ))}
      </div>

      {activeTab === 'rides' && (
        <div className="space-y-3">
          {rides.map(ride => (
            <div key={ride.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-xs font-bold text-primary">#{ride.id} - {ride.client_name}</p>
                  <p className="text-[10px] text-slate-400">{ride.client_phone || 'Sem Telefone'} • {new Date(ride.created_at).toLocaleString()}</p>
                </div>
                <span className={cn(
                  "text-[8px] font-black px-2 py-1 rounded uppercase",
                  ride.status === 'finished' ? "bg-green-100 text-green-600" : 
                  ride.status === 'danger' ? "bg-red-100 text-red-600 animate-pulse" :
                  "bg-slate-100 text-slate-500"
                )}>
                  {ride.status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 text-[10px] mb-3">
                <div>
                  <p className="text-slate-400 font-bold uppercase">Motorista</p>
                  <p className="font-medium">{ride.driver_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase">Valor / Comissão</p>
                  <p className="font-medium">MT {ride.final_price || 0} / <span className="text-secondary">MT {ride.admin_fee?.toFixed(2) || 0}</span></p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => viewOffers(ride.id)}
                  className="flex items-center justify-center gap-2 text-[10px] font-bold text-secondary bg-secondary/5 py-2 rounded-lg"
                >
                  <DollarSign size={12} /> Ver Ofertas
                </button>
                <button 
                  onClick={() => viewMessages(ride.id)}
                  className="flex items-center justify-center gap-2 text-[10px] font-bold text-primary bg-primary/5 py-2 rounded-lg"
                >
                  <MessageSquare size={12} /> Ver Mensagens
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'drivers' && (
        <div className="space-y-3">
          {drivers.map(d => (
            <div key={d.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-slate-100 p-2 rounded-full">
                    {d.category === 'Moto' ? <Bike size={18} /> : d.category === 'Txopela' ? <Navigation size={18} /> : <Car size={18} />}
                  </div>
                  <div>
                    <p className="font-bold text-sm">{d.name}</p>
                    <p className="text-[10px] text-slate-400">{d.phone} • {d.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Chave</p>
                  <p className="text-xs font-mono font-bold">{d.access_key}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-50">
                <div className="bg-slate-50 p-2 rounded-xl text-center">
                  <p className="text-[8px] text-slate-400 font-bold uppercase">Corridas</p>
                  <p className="text-xs font-black text-primary">{d.total_rides || 0}</p>
                </div>
                <div className="bg-secondary/5 p-2 rounded-xl text-center">
                  <p className="text-[8px] text-secondary font-bold uppercase">Comissão</p>
                  <p className="text-xs font-black text-secondary">MT {d.total_commission?.toFixed(2) || '0.00'}</p>
                </div>
                <button 
                  onClick={() => viewDriverRides(d)}
                  className="bg-primary text-white text-[10px] font-bold rounded-xl flex items-center justify-center gap-1"
                >
                  Ver Tudo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'register' && (
        <form onSubmit={registerDriver} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Nome Completo</label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={newDriver.name}
              onChange={e => setNewDriver({ ...newDriver, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Telefone</label>
            <input
              type="tel"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={newDriver.phone}
              onChange={e => setNewDriver({ ...newDriver, phone: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Chave de Acesso</label>
            <input
              type="text"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={newDriver.key}
              onChange={e => setNewDriver({ ...newDriver, key: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-400 uppercase">Categoria</label>
            <select
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={newDriver.category}
              onChange={e => setNewDriver({ ...newDriver, category: e.target.value as Category })}
            >
              <option value="Moto">Moto</option>
              <option value="Txopela">Txopela</option>
              <option value="Taxi">Taxi</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-primary text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 mt-2"
          >
            Registrar Motorista
          </button>
        </form>
      )}

      {selectedRideOffers && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-primary">Ofertas Corrida #{selectedRideOffers.rideId}</h3>
              <button onClick={() => setSelectedRideOffers(null)} className="text-slate-400 hover:text-slate-600">X</button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
              {selectedRideOffers.offers.map((o) => (
                <div key={o.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-sm text-primary">{o.driver_name}</p>
                    <p className="text-[10px] text-slate-400">{o.driver_category}</p>
                  </div>
                  <p className="text-lg font-black text-secondary">MT {o.price}</p>
                </div>
              ))}
              {selectedRideOffers.offers.length === 0 && <p className="text-center text-slate-400 text-xs italic">Nenhuma oferta recebida.</p>}
            </div>
          </div>
        </div>
      )}

      {selectedRideMessages && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-primary">Chat Corrida #{selectedRideMessages.rideId}</h3>
              <button onClick={() => setSelectedRideMessages(null)} className="text-slate-400 hover:text-slate-600">X</button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
              {selectedRideMessages.messages.map((m) => (
                <div key={m.id} className={cn(
                  "p-3 rounded-xl text-xs",
                  m.sender_role === 'client' ? "bg-slate-100 mr-8" : "bg-primary/10 ml-8 text-right"
                )}>
                  <p className="font-bold text-[8px] uppercase text-slate-400 mb-1">{m.sender_role}</p>
                  <p>{m.text}</p>
                </div>
              ))}
              {selectedRideMessages.messages.length === 0 && <p className="text-center text-slate-400 text-xs italic">Nenhuma mensagem trocada.</p>}
            </div>
          </div>
        </div>
      )}

      {selectedDriverRides && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-primary">Corridas de {selectedDriverRides.driverName}</h3>
              <button onClick={() => setSelectedDriverRides(null)} className="text-slate-400 hover:text-slate-600">X</button>
            </div>
            <div className="space-y-3 max-h-96 overflow-y-auto mb-4">
              {selectedDriverRides.rides.map((r) => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[10px] font-bold text-primary">#{r.id} - {r.client_name}</p>
                    <span className="text-[8px] font-black uppercase text-slate-400">{r.status}</span>
                  </div>
                  <p className="text-[10px] text-slate-600 truncate">{r.pickup} → {r.destination}</p>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200/50">
                    <p className="text-[10px] font-bold">MT {r.final_price || 0}</p>
                    <p className="text-[10px] font-bold text-secondary">Comissão: MT {r.admin_fee?.toFixed(2) || 0}</p>
                  </div>
                </div>
              ))}
              {selectedDriverRides.rides.length === 0 && <p className="text-center text-slate-400 text-xs italic">Nenhuma corrida encontrada.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
