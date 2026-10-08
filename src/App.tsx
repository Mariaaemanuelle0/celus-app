import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { lazy, type ComponentType } from 'react';
import { Entrar, Verificar } from './pages/Entrar';

// Cada tela é baixada só quando a pessoa abre: a entrada no app fica leve e o mapa vem depois.
const sob = <M extends Record<string, ComponentType>>(f: () => Promise<M>, nome: keyof M) => lazy(() => f().then((m) => ({ default: m[nome] })));
const AnuncioPage = sob(() => import('./pages/AnuncioPage'), 'AnuncioPage');
const ChatPage = sob(() => import('./pages/ChatPage'), 'ChatPage');
const FeedPage = sob(() => import('./pages/FeedPage'), 'FeedPage');
const PostarStory = sob(() => import('./pages/FeedPage'), 'PostarStory');
const MapPage = sob(() => import('./pages/MapPage'), 'MapPage');
const PerfilPage = sob(() => import('./pages/PerfilPage'), 'PerfilPage');
const CelusPage = sob(() => import('./pages/PerfilPage'), 'CelusPage');
const EditarPerfil = sob(() => import('./pages/PerfilPage'), 'EditarPerfil');
const ExcluirConta = sob(() => import('./pages/PerfilPage'), 'ExcluirConta');
const Painel = sob(() => import('./pages/Renda'), 'Painel');
const Anunciar = sob(() => import('./pages/Renda'), 'Anunciar');
const AgendaPage = sob(() => import('./pages/Renda'), 'AgendaPage');
const Curadoria = sob(() => import('./pages/Renda'), 'Curadoria');
const EditarAnuncio = sob(() => import('./pages/Renda'), 'EditarAnuncio');
const Portaria = sob(() => import('./pages/Renda'), 'Portaria');
const Recebimento = sob(() => import('./pages/Renda'), 'Recebimento');
const Notificacoes = sob(() => import('./pages/Notificacoes'), 'Notificacoes');
const ReservaPage = sob(() => import('./pages/ReservaPage'), 'ReservaPage');
const UsoPage = sob(() => import('./pages/ReservaPage'), 'UsoPage');
const Comunidades = sob(() => import('./pages/Comunidade'), 'Comunidades');
const NovaComunidade = sob(() => import('./pages/Comunidade'), 'NovaComunidade');
const ComunidadePage = sob(() => import('./pages/Comunidade'), 'ComunidadePage');
const Trocas = sob(() => import('./pages/Trocas'), 'Trocas');
const NovaTroca = sob(() => import('./pages/Trocas'), 'NovaTroca');
const TrocaPage = sob(() => import('./pages/Trocas'), 'TrocaPage');
const Pessoa = sob(() => import('./pages/Pessoa'), 'Pessoa');
const SaudePage = sob(() => import('./pages/Saude'), 'SaudePage');
const CheckinTreino = sob(() => import('./pages/Saude'), 'CheckinTreino');
const PainelSaude = sob(() => import('./pages/Saude'), 'PainelSaude');
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
          <Route path="comunidade" element={<Comunidades />} />
          <Route path="comunidade/nova" element={<NovaComunidade />} />
          <Route path="comunidade/:id" element={<ComunidadePage />} />
          <Route path="trocas" element={<Trocas />} />
          <Route path="trocas/nova" element={<NovaTroca />} />
          <Route path="troca/:id" element={<TrocaPage />} />
          <Route path="pessoa/:id" element={<Pessoa />} />
          <Route path="saude" element={<SaudePage />} />
          <Route path="saude/checkin" element={<CheckinTreino />} />
          <Route path="renda/saude" element={<PainelSaude />} />
          <Route path="perfil" element={<PerfilPage />} />
          <Route path="perfil/editar" element={<EditarPerfil />} />
          <Route path="perfil/excluir" element={<ExcluirConta />} />
          <Route path="renda/recebimento" element={<Recebimento />} />
          <Route path="celus" element={<CelusPage />} />
          <Route path="notificacoes" element={<Notificacoes />} />
          <Route path="renda" element={<Painel />} />
          <Route path="renda/anunciar" element={<Anunciar />} />
          <Route path="renda/agenda/:id" element={<AgendaPage />} />
          <Route path="renda/editar/:id" element={<EditarAnuncio />} />
          <Route path="renda/portaria/:id" element={<Portaria />} />
          <Route path="renda/curadoria" element={<Curadoria />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
