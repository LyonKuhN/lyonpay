import { Link } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import { Card, EmptyState, PageHeader } from '../components/ui/primitives';

export default function AdminLembretes() {
  return (
    <div className="space-y-4 lg:space-y-5">
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-fg">
        <ArrowLeft size={16} /> Administração
      </Link>
      <PageHeader title="Lembretes" description="Avisos e alertas agendados." />
      <Card>
        <EmptyState
          icon={Construction}
          title="Em construção"
          description="O módulo de lembretes do administrador está sendo desenvolvido e estará disponível em breve."
        />
      </Card>
    </div>
  );
}
