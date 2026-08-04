import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useHorarios, useCriarHorario, useDeleteHorario } from '@/hooks/useHorarios';
import { useTranslation } from '@/hooks/useTranslation';

interface Intervalo {
  id?: string;
  horaInicio: string;
  horaFim: string;
}

const DIAS_SEMANA = [
  { id: 1, key: 'monday' },
  { id: 2, key: 'tuesday' },
  { id: 3, key: 'wednesday' },
  { id: 4, key: 'thursday' },
  { id: 5, key: 'friday' },
  { id: 6, key: 'saturday' },
  { id: 0, key: 'sunday' },
];

export function HorarioDisponibilidadeCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.profile?.id;

  const dias = DIAS_SEMANA.map(d => ({ id: d.id, nome: t(`mySchedule.days.${d.key}`) }));

  const { data: horariosExistentes = [], isLoading } = useHorarios(userId);
  const criarHorario = useCriarHorario();
  const deleteHorario = useDeleteHorario();

  const [horarios, setHorarios] = useState<Record<number, Intervalo[]>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const map: Record<number, Intervalo[]> = {};
    dias.forEach(dia => {
      map[dia.id] = horariosExistentes
        .filter(h => h.day_of_week === dia.id && h.is_available)
        .map(h => ({ id: h.id, horaInicio: h.start_time.slice(0, 5), horaFim: h.end_time.slice(0, 5) }));
    });
    setHorarios(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, horariosExistentes]);

  const addIntervalo = (dia: number) => {
    setHorarios(prev => ({ ...prev, [dia]: [...(prev[dia] || []), { horaInicio: '09:00', horaFim: '18:00' }] }));
  };

  const removeIntervalo = (dia: number, index: number) => {
    setHorarios(prev => ({ ...prev, [dia]: prev[dia].filter((_, i) => i !== index) }));
  };

  const updateIntervalo = (dia: number, index: number, field: 'horaInicio' | 'horaFim', value: string) => {
    setHorarios(prev => ({ ...prev, [dia]: prev[dia].map((it, i) => (i === index ? { ...it, [field]: value } : it)) }));
  };

  const salvar = async () => {
    if (!userId) return;
    setIsSubmitting(true);
    try {
      await Promise.all(horariosExistentes.map(h => deleteHorario.mutateAsync(h.id)));
      await Promise.all(
        Object.entries(horarios).flatMap(([dia, intervalos]) =>
          intervalos
            .filter(it => it.horaInicio && it.horaFim)
            .map(it =>
              criarHorario.mutateAsync({
                user_id: userId,
                day_of_week: Number(dia),
                start_time: it.horaInicio,
                end_time: it.horaFim,
                is_available: true,
              }),
            ),
        ),
      );
      toast.success('Horários de disponibilidade salvos!');
    } catch {
      toast.error('Erro ao salvar horários');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="p-6 rounded-[2px]">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold">Disponibilidade</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Seus horários de trabalho, usados para checar disponibilidade ao agendar e reagendar reuniões.
          </p>
        </div>
        <Button
          size="sm"
          className="rounded-[4px] h-[30px] text-xs shrink-0"
          onClick={salvar}
          disabled={isSubmitting || isLoading}
        >
          {isSubmitting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
          Salvar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Carregando horários...
        </div>
      ) : (
        <div className="space-y-2">
          {dias.map(dia => (
            <div key={dia.id} className="p-3 rounded-[4px] border border-border">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{dia.nome}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-[26px] px-2 text-xs rounded-[4px]"
                  onClick={() => addIntervalo(dia.id)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>

              {(horarios[dia.id] || []).length === 0 ? (
                <p className="text-xs text-muted-foreground/60 italic mt-1.5">Indisponível</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {horarios[dia.id].map((intervalo, index) => (
                    <div key={index} className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-muted-foreground shrink-0" />
                      <Input
                        type="time"
                        value={intervalo.horaInicio}
                        onChange={e => updateIntervalo(dia.id, index, 'horaInicio', e.target.value)}
                        className="h-[28px] text-xs rounded-[4px] w-[110px]"
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={intervalo.horaFim}
                        onChange={e => updateIntervalo(dia.id, index, 'horaFim', e.target.value)}
                        className="h-[28px] text-xs rounded-[4px] w-[110px]"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-[28px] w-[28px] p-0 rounded-[4px] text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => removeIntervalo(dia.id, index)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
