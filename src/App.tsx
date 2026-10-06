import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AnuncioPage } from './pages/AnuncioPage';
import { ChatPage } from './pages/ChatPage';
import { Entrar, Verificar } from './pages/Entrar';
import { FeedPage, PostarStory } from './pages/FeedPage';
import { MapPage } from './pages/MapPage';
import { CelusPage, EditarPerfil, PerfilPage } from './pages/PerfilPage';
import { Anunciar, AgendaPage, Curadoria, EditarAnuncio, Painel } from './pages/Renda';
import { Notificacoes } from './pages/Notificacoes';
import { ReservaPage, UsoPage } from './pages/ReservaPage';
import { useUsuario } from './store/db';

function SoDeslogado({ children }: { children: React.ReactNode }) {
  return useUsuario() ? <Navigate to="/" replace /> : <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="entrar" element={<SoDeslogado><Entrar /></SoDeslogado>} />
        <Route path="verificar" element={<Verificar />} />
        <Route element={<Layout />}>
          <Route index element={<MapPage />} />
          <Route path="anuncio/:id" element={<AnuncioPage />} />
          <Route path="reserva/:id" element={<ReservaPage />} />
          <Route path="uso/:id" element={<UsoPage />} />
          <Route path="story/:id" element={<PostarStory />} />
          <Route path="feed" element={<FeedPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="perfil/editar" element={<EditarPerfil />} />
          <Route path="celus" element={<CelusPage />} />
          <Route path="notificacoes" element={<Notificacoes />} />
          <Route path="renda" element={<Painel />} />
          <Route path="renda/anunciar" element={<Anunciar />} />
          <Route path="renda/agenda/:id" element={<AgendaPage />} />
          <Route path="renda/editar/:id" element={<EditarAnuncio />} />
          <Route path="renda/curadoria" element={<Curadoria />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
