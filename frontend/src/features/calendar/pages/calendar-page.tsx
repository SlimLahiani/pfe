import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Calendar, Plus, Trash2, Edit, ChevronLeft, ChevronRight, Download, RotateCcw } from 'lucide-react';
import { useCalendarEvents, useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent, useRestoreCalendarEvent, type CalendarEvent } from '../../../hooks/use-api';
import {
  PageHeader, SelectFilter, Dialog, FormField, Input, Select, Textarea, Button, StatCard, Tabs, StatusBadge,
} from '../../../components/shared/ui';
import { exportToCSV } from '../../../lib/export-csv';

const EVENT_TYPES = [
  { label: 'Réunion', value: 'MEETING' },
  { label: 'Date limite', value: 'DEADLINE' },
  { label: 'Événement', value: 'EVENT' },
  { label: 'Rappel', value: 'REMINDER' },
  { label: 'Absent', value: 'OUT_OF_OFFICE' },
];

const EVENT_TYPE_COLORS: Record<string, string> = {
  MEETING: 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300',
  DEADLINE: 'bg-red-500/20 border-red-500/30 text-red-300',
  EVENT: 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300',
  REMINDER: 'bg-amber-500/20 border-amber-500/30 text-amber-300',
  OUT_OF_OFFICE: 'bg-gray-500/20 border-gray-500/30 text-gray-300',
};

interface EventFormData {
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  location?: string;
  type: string;
}

const DAYS_OF_WEEK = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export const CalendarPage: React.FC = () => {
  const [viewMode, setViewMode] = useState('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const { data, isLoading } = useCalendarEvents({
    limit: 100,
    type: typeFilter || undefined,
    isArchived: showArchived,
  });
  
  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const restoreEvent = useRestoreCalendarEvent();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EventFormData>({
    defaultValues: { type: 'MEETING' },
  });

  const openCreate = (date?: Date) => {
    setEditingEvent(null);
    const dateStr = (date ?? new Date()).toISOString().slice(0, 16);
    reset({ title: '', description: '', startTime: dateStr, endTime: dateStr, location: '', type: 'MEETING' });
    setDialogOpen(true);
  };

  const openEdit = (event: CalendarEvent) => {
    setEditingEvent(event);
    reset({
      title: event.title,
      description: event.description ?? '',
      startTime: event.startTime.slice(0, 16),
      endTime: event.endTime.slice(0, 16),
      location: event.location ?? '',
      type: event.type,
    });
    setDialogOpen(true);
  };

  const onSubmit = async (formData: EventFormData) => {
    if (editingEvent) {
      await updateEvent.mutateAsync({ id: editingEvent.id, data: formData });
    } else {
      await createEvent.mutateAsync(formData);
    }
    setDialogOpen(false);
    reset();
  };

  const handleExportCSV = () => {
    const dataToExport = data?.data ?? [];
    const columns = [
      { header: 'Titre', key: 'title' },
      { header: 'Type', key: 'type' },
      { header: 'Date de début', key: 'startTime', transform: (val: string) => new Date(val).toLocaleString() },
      { header: 'Date de fin', key: 'endTime', transform: (val: string) => new Date(val).toLocaleString() },
      { header: 'Lieu', key: 'location' },
      { header: 'Description', key: 'description' },
    ];
    exportToCSV(dataToExport, columns, `calendrier-${showArchived ? 'archives-' : ''}${Date.now()}.csv`);
  };

  // Calendar grid logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const eventsInMonth = (data?.data ?? []).filter((e) => {
    const d = new Date(e.startTime);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const getEventsForDay = (day: number) =>
    eventsInMonth.filter((e) => new Date(e.startTime).getDate() === day);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const upcomingEvents = (data?.data ?? [])
    .filter((e) => new Date(e.startTime) >= new Date())
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendrier"
        description="Planifiez les réunions, les dates limites et les événements de l'agence"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExportCSV}>
              Exporter CSV
            </Button>
            <Button icon={<Plus size={16} />} onClick={() => openCreate()}>Nouvel événement</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total des Événements" value={data?.total ?? 0} icon={<Calendar size={20} />} colorClass="bg-indigo-500/10 text-indigo-400" />
        <StatCard label="Réunions" value={(data?.data ?? []).filter(e => e.type === 'MEETING').length} icon={<Calendar size={20} />} colorClass="bg-purple-500/10 text-purple-400" />
        <StatCard label="Dates limites" value={(data?.data ?? []).filter(e => e.type === 'DEADLINE').length} icon={<Calendar size={20} />} colorClass="bg-red-500/10 text-red-400" />
        <StatCard label="Ce Mois-ci" value={eventsInMonth.length} icon={<Calendar size={20} />} colorClass="bg-emerald-500/10 text-emerald-400" />
      </div>

      <div className="flex flex-col sm:flex-row justify-between gap-3 items-center">
        <div className="flex gap-3 items-center w-full sm:w-auto">
          <SelectFilter value={typeFilter} onChange={(v) => setTypeFilter(v)} options={EVENT_TYPES} placeholder="Tous les types" />
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground select-none cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-0"
            />
            Afficher Archivés
          </label>
        </div>
        <Tabs
          tabs={[{ label: 'Calendrier', value: 'calendar' }, { label: 'Liste', value: 'list' }]}
          active={viewMode}
          onChange={setViewMode}
        />
      </div>

      {viewMode === 'calendar' ? (
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Month Navigation */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <button onClick={prevMonth} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <h4 className="font-bold text-white">{MONTHS[month]} {year}</h4>
            <button onClick={nextMonth} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 border-b border-white/5">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="py-3 text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="h-28 border-b border-r border-white/[0.03] bg-white/[0.01]" />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;

              return (
                <div
                  key={day}
                  className="h-28 border-b border-r border-white/[0.03] p-1.5 hover:bg-white/[0.02] transition-colors cursor-pointer group"
                  onClick={() => openCreate(new Date(year, month, day))}
                >
                  <div className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1 ${
                    isToday ? 'bg-indigo-500 text-white' : 'text-muted-foreground group-hover:text-white'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayEvents.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border truncate ${EVENT_TYPE_COLORS[event.type] ?? 'bg-white/5 border-white/10 text-gray-300'}`}
                        onClick={(e) => { e.stopPropagation(); openEdit(event); }}
                      >
                        {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-[9px] text-muted-foreground pl-1">+{dayEvents.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <div key={i} className="glass-card rounded-xl p-4 h-16 animate-pulse" />)
          ) : upcomingEvents.length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center text-muted-foreground">Aucun événement à venir</div>
          ) : (
            upcomingEvents.map((event) => (
              <div key={event.id} className="glass-card rounded-xl p-4 flex items-center justify-between gap-4 group">
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-10 rounded-full ${
                    event.type === 'DEADLINE' ? 'bg-red-500' :
                    event.type === 'MEETING' ? 'bg-indigo-500' :
                    event.type === 'EVENT' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                  <div>
                    <p className="font-semibold text-white text-sm">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.startTime).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                      {event.location && ` · ${event.location}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={event.type} />
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {showArchived || (event as any).isArchived ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); restoreEvent.mutate(event.id); }}
                        className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors flex items-center gap-1 text-xs"
                        title="Restaurer"
                      >
                        <RotateCcw size={13} /> Restaurer
                      </button>
                    ) : (
                      <>
                        <button onClick={() => openEdit(event)} className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"><Edit size={13} /></button>
                        <button onClick={() => setDeleteConfirm(event.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"><Trash2 size={13} /></button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Dialog isOpen={dialogOpen} onClose={() => setDialogOpen(false)} title={editingEvent ? 'Modifier l\'événement' : 'Nouvel événement'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField label="Titre" required error={errors.title?.message}>
            <Input {...register('title', { required: 'Requis' })} placeholder="Réunion d'équipe" />
          </FormField>
          <FormField label="Type" required>
            <Select {...register('type', { required: true })}>
              {EVENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Heure de début" required error={errors.startTime?.message}>
              <Input {...register('startTime', { required: 'Requis' })} type="datetime-local" />
            </FormField>
            <FormField label="Heure de fin" required error={errors.endTime?.message}>
              <Input {...register('endTime', { required: 'Requis' })} type="datetime-local" />
            </FormField>
          </div>
          <FormField label="Lieu">
            <Input {...register('location')} placeholder="Salle de réunion A / Google Meet" />
          </FormField>
          <FormField label="Description">
            <Textarea {...register('description')} placeholder="Ordre du jour, liens, notes..." rows={3} />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            {editingEvent && ((editingEvent as any).isArchived) && (
              <Button
                variant="secondary"
                type="button"
                className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 mr-auto flex items-center gap-1"
                onClick={async () => {
                  await restoreEvent.mutateAsync(editingEvent.id);
                  setDialogOpen(false);
                }}
              >
                <RotateCcw size={14} /> Restaurer l'événement
              </Button>
            )}
            <Button variant="secondary" type="button" onClick={() => setDialogOpen(false)}>Annuler</Button>
            {!(editingEvent && ((editingEvent as any).isArchived)) && (
              <Button type="submit" isLoading={isSubmitting}>{editingEvent ? 'Enregistrer' : 'Créer l\'événement'}</Button>
            )}
          </div>
        </form>
      </Dialog>

      <Dialog isOpen={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Supprimer l'événement" size="sm">
        <p className="text-sm text-muted-foreground mb-6">Supprimer définitivement cet événement ?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Annuler</Button>
          <Button variant="danger" isLoading={deleteEvent.isPending} onClick={() => deleteConfirm && deleteEvent.mutateAsync(deleteConfirm).then(() => setDeleteConfirm(null))}>Supprimer</Button>
        </div>
      </Dialog>
    </div>
  );
};
