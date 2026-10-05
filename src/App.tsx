import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AnuncioPage } from './pages/AnuncioPage';
import { EmBreve } from './pages/EmBreve';
import { MapPage } from './pages/MapPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<MapPage />} />
          <Route path="anuncio/:id" element={<AnuncioPage />} />
          <Route path="feed" element={<EmBreve titulo="Feed" etapa={6} texto="Stories de 3 horas e posts dos espaços chegam na etapa 6." />} />
          <Route path="chat" element={<EmBreve titulo="Chat do quadrante" etapa={7} texto="A sala da sua região, com mensagens que somem em 10 minutos, chega na etapa 7." />} />
          <Route path="perfil" element={<EmBreve titulo="Perfil" etapa={2} texto="Login, reservas, livro dos sonhos e celus chegam a partir da etapa 2." />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
