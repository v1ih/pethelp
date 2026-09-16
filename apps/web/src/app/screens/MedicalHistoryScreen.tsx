import React, { useState } from 'react';
import { ArrowLeft, Calendar, Download, Eye, FileText, Paperclip, Pencil, Plus, ShieldAlert, Star, Trash2, Upload, X } from 'lucide-react';
import { decodeExamDocument, encodeExamDocument } from '../context/shared';
import { useHealth } from '../context/HealthContext';
import { useReviews } from '../context/ReviewsContext';
import { useSession } from '../context/SessionContext';
import VeterinarianShell from '../components/layout/VeterinarianShell';
import { usePets } from '../context/PetsContext';
import { useAppNavigation } from '../navigation';
import { TutorShell } from '../components/layout/TutorShell';

type PreviewAttachment = {
  name: string;
  type: string;
  dataUrl: string;
};

function bytesToLabel(size: number) {
  if (!Number.isFinite(size) || size <= 0) return 'Tamanho desconhecido';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

function encodeFile(file: File, dataUrl: string): string {
  return encodeExamDocument({
    name: file.name,
    type: file.type || 'application/octet-stream',
    size: file.size,
    dataUrl,
  });
}

function isSupportedFile(file: File) {
  const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  const supportedExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
  const lowerName = file.name.toLowerCase();
  return supportedTypes.includes(file.type) || supportedExtensions.some((extension) => lowerName.endsWith(extension));
}

export default function MedicalHistoryScreen() {
  const { currentPet } = usePets();
  const { medicalRecords, addMedicalRecord, updateMedicalRecord, deleteMedicalRecord } = useHealth();
  const { getVeterinarianAverage, getVeterinarianReviews } = useReviews();
  const { user } = useSession();
  const { goToPetContext } = useAppNavigation();
  const isVeterinarian = user?.userType === 'veterinarian';
  const [vetTab, setVetTab] = useState<'consults' | 'reviews'>('consults');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originalDocuments, setOriginalDocuments] = useState<string[]>([]);
  const [editingDocuments, setEditingDocuments] = useState<string[]>([]);
  const [replaceAttachments, setReplaceAttachments] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<PreviewAttachment | null>(null);
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [treatment, setTreatment] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  if (isVeterinarian) {
    const sortedVeterinarianRecords = medicalRecords.slice().sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());
    const veterinarianReviews = getVeterinarianReviews(user?.id ?? '');
    const veterinarianAverage = getVeterinarianAverage(user?.id ?? '');

    return (
      <VeterinarianShell active="history" title="Histórico & Avaliações" description="Consulte atendimentos recentes e avaliações deixadas pelos tutores.">
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
              <p className="text-sm text-muted-foreground">Consultas</p>
              <p className="mt-2 text-3xl text-foreground">{sortedVeterinarianRecords.length}</p>
              <p className="text-sm text-muted-foreground">Registros clínicos</p>
            </div>
            <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
              <p className="text-sm text-muted-foreground">Avaliações</p>
              <p className="mt-2 text-3xl text-foreground">{veterinarianReviews.length}</p>
              <p className="text-sm text-muted-foreground">Notas recebidas</p>
            </div>
            <div className="rounded-[28px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
              <p className="text-sm text-muted-foreground">Média</p>
              <p className="mt-2 text-3xl text-foreground">{veterinarianAverage > 0 ? veterinarianAverage.toFixed(1) : '0.0'}</p>
              <p className="text-sm text-muted-foreground">Reputação geral</p>
            </div>
          </section>

          <section className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <div className="flex items-center gap-8 border-b border-border/80">
              <button type="button" onClick={() => setVetTab('consults')} className={`relative pb-4 pt-2 text-[18px] font-medium transition-colors ${vetTab === 'consults' ? 'text-primary' : 'text-[#7b6e61]'}`}>
                Consultas realizadas
                {vetTab === 'consults' ? <span className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-primary" /> : null}
              </button>
              <button type="button" onClick={() => setVetTab('reviews')} className={`relative pb-4 pt-2 text-[18px] font-medium transition-colors ${vetTab === 'reviews' ? 'text-primary' : 'text-[#7b6e61]'}`}>
                Avaliações recebidas
                {vetTab === 'reviews' ? <span className="absolute inset-x-0 bottom-[-1px] h-[2px] rounded-full bg-primary" /> : null}
              </button>
            </div>

            {vetTab === 'consults' ? (
              <div className="mt-6 space-y-4">
                {sortedVeterinarianRecords.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">Nenhum atendimento encontrado para este veterinário.</div>
                ) : (
                  sortedVeterinarianRecords.map((record) => {
                    const attachments = (record.documents ?? []).length;

                    return (
                      <article key={record.id} className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_18px_42px_-30px_rgba(127,162,106,0.2)]">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-lg text-foreground">{record.clinicName || 'Atendimento clínico'}</p>
                            <p className="text-sm text-muted-foreground">{record.veterinarianName || 'Veterinário responsável'}{record.addedBy ? ` · ${record.addedBy}` : ''}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">{formatDateLabel(record.date)}</p>
                        </div>
                        <p className="mt-4 text-sm leading-relaxed text-foreground">{record.description}</p>
                        {record.treatment ? <p className="mt-3 rounded-2xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">{record.treatment}</p> : null}
                        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                          <span className="rounded-full border border-border bg-background px-3 py-1">{attachments} anexo{attachments === 1 ? '' : 's'}</span>
                          <span className="rounded-full border border-border bg-background px-3 py-1">{record.petId}</span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {veterinarianReviews.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-border bg-muted/30 p-5 text-sm text-muted-foreground">Nenhuma avaliação recebida ainda.</div>
                ) : (
                  veterinarianReviews.map((review) => (
                    <article key={review.id} className="rounded-[28px] border border-border/70 bg-card p-5 shadow-[0_18px_42px_-30px_rgba(127,162,106,0.2)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-lg text-foreground">{review.tutorName} · {review.petId}</p>
                          <p className="text-sm text-muted-foreground">{review.clinicName || 'Atendimento particular'}</p>
                        </div>
                        <div className="flex items-center gap-1 text-primary">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star key={index} className={`h-5 w-5 ${index < review.rating ? 'fill-current' : 'text-[#e0d9cf]'}`} />
                          ))}
                        </div>
                      </div>
                      <p className="mt-4 text-sm italic text-foreground">“{review.comment}”</p>
                      <p className="mt-2 text-xs text-muted-foreground">{new Date(review.updatedAt).toLocaleDateString('pt-BR')}</p>
                    </article>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </VeterinarianShell>
    );
  }
  if (!currentPet) {
    return (
      <TutorShell active="records" title="Histórico médico" description="Nenhum pet selecionado no momento.">
        <div className="mx-auto max-w-2xl rounded-[34px] border border-border/70 bg-card p-10 text-center shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
          <p className="text-foreground mb-4">Nenhum pet selecionado</p>
          <button onClick={goToPetContext} className="rounded-[18px] bg-primary px-6 py-3 text-white transition-colors hover:bg-primary/90">Voltar</button>
        </div>
      </TutorShell>
    );
  }

  const petRecords = medicalRecords.filter((record) => record.petId === currentPet.id);

  const clearForm = () => {
    setEditingId(null);
    setOriginalDocuments([]);
    setEditingDocuments([]);
    setReplaceAttachments(false);
    setPreviewAttachment(null);
    setDate('');
    setDescription('');
    setClinicName('');
    setTreatment('');
    setSelectedFiles([]);
    setShowForm(false);
  };

  const startCreate = () => {
    clearForm();
    setShowForm(true);
  };

  const startEdit = (record: (typeof petRecords)[number]) => {
    setEditingId(record.id);
    const nextDocuments = record.documents ?? [];
    setOriginalDocuments(nextDocuments);
    setEditingDocuments(nextDocuments);
    setReplaceAttachments(false);
    setPreviewAttachment(null);
    setDate(record.date);
    setDescription(record.description);
    setClinicName(record.clinicName || '');
    setTreatment(record.treatment || '');
    setSelectedFiles([]);
    setShowForm(true);
  };

  const removeExistingAttachment = (documentToRemove: string) => {
    setEditingDocuments((prev) => prev.filter((document) => document !== documentToRemove));
  };

  const startReplaceAttachments = () => {
    setReplaceAttachments(true);
    setEditingDocuments([]);
  };

  const cancelReplaceAttachments = () => {
    setReplaceAttachments(false);
    setEditingDocuments(originalDocuments);
  };

  const removeNewAttachment = (fileIndex: number) => {
    setSelectedFiles((prev) => prev.filter((_, index) => index !== fileIndex));
  };

  const openAttachmentPreview = (attachment: PreviewAttachment) => {
    setPreviewAttachment(attachment);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !description.trim()) return;

    const invalidFile = selectedFiles.find((file) => !isSupportedFile(file));
    if (invalidFile) {
      setFeedback({ type: 'error', message: 'Apenas arquivos PDF, JPG e PNG sao aceitos nos anexos.' });
      return;
    }

    setFeedback(null);

    try {
      const newDocuments = await Promise.all(selectedFiles.map(async (file) => {
        const dataUrl = await fileToDataUrl(file);
        return encodeFile(file, dataUrl);
      }));

      const documents = editingId
        ? replaceAttachments
          ? newDocuments.length > 0
            ? newDocuments
            : undefined
          : [...editingDocuments, ...newDocuments]
        : newDocuments.length > 0
          ? newDocuments
          : undefined;

      const recordPayload = {
        date,
        description: description.trim(),
        clinicName: clinicName.trim() || undefined,
        treatment: treatment.trim() || undefined,
        documents,
      };

      if (editingId) {
        await updateMedicalRecord(editingId, recordPayload);
      } else {
        await addMedicalRecord({ petId: currentPet.id, ...recordPayload });
      }

      setFeedback({ type: 'success', message: editingId ? 'Registro atualizado com sucesso.' : 'Registro criado com sucesso.' });
      clearForm();
    } catch (error) {
      console.error('Falha ao salvar registro medico:', error);
      setFeedback({ type: 'error', message: 'Não foi possível salvar o registro médico.' });
    }
  };

  return (
    <TutorShell active="records" title="Histórico médico" description={`Prontuário clínico cronológico de ${currentPet.name}`} actions={<button onClick={() => (showForm ? clearForm() : startCreate())} className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-5 py-3 text-white transition-colors hover:bg-primary/90">{showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}<span>{editingId ? 'Editar Registro' : 'Adicionar Registro'}</span></button>}>
      <div className="space-y-6">
        {feedback && <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type === 'success' ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{feedback.message}</div>}

        {showForm && (
          <form onSubmit={handleSubmit} className="rounded-[34px] border border-border/70 bg-card p-6 shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)] sm:p-8">
            <h2 className="mb-4 text-2xl font-medium text-foreground">{editingId ? 'Editar Evento Clínico' : 'Adicionar Evento Clínico'}</h2>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-foreground">Data do Evento *</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" required />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-foreground">Clínica / Hospital (Opcional)</label>
                  <input type="text" value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="Ex: Clínica Veterinária São Francisco" className="w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-foreground">Descrição da Consulta / Sintomas *</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o motivo da consulta, diagnóstico ou sintomas apresentados..." className="min-h-[120px] w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" required />
              </div>

              <div>
                <label className="mb-2 block text-sm text-foreground">Tratamento Prescrito / Medicamentos (Opcional)</label>
                <textarea value={treatment} onChange={(e) => setTreatment(e.target.value)} placeholder="Ex: Antibiótico x de 12h em 12h por 7 dias, repouso..." className="min-h-[100px] w-full rounded-[18px] border border-border bg-[#efe9de] px-4 py-3 text-foreground outline-none transition-colors focus:border-primary" />
              </div>

              <div>
                <label className="mb-2 block text-sm text-foreground">Anexos do exame (Opcional)</label>
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))} className="w-full rounded-[18px] border border-border bg-background px-4 py-3 text-foreground file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary/90" />
                <p className="mt-2 text-xs text-muted-foreground">Arquivos aceitos: PDF, JPG e PNG.</p>
              </div>

              {editingId && originalDocuments.length > 0 && (
                <div className="rounded-[28px] border border-border bg-muted/40 p-4">
                  <div className="mb-2 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm text-foreground">Anexos atuais</p>
                      <span className="text-xs text-muted-foreground">Clique no nome para visualizar</span>
                    </div>
                    {!replaceAttachments ? (
                      <button type="button" onClick={startReplaceAttachments} className="inline-flex items-center gap-2 rounded-[18px] border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary hover:bg-primary/10 transition-colors">
                        <Upload className="h-3.5 w-3.5" /> Substituir anexo
                      </button>
                    ) : (
                      <button type="button" onClick={cancelReplaceAttachments} className="inline-flex items-center gap-2 rounded-[18px] border border-border bg-background px-3 py-2 text-xs text-foreground hover:bg-muted transition-colors">
                        <X className="h-3.5 w-3.5" /> Cancelar substituição
                      </button>
                    )}
                  </div>
                  {replaceAttachments ? (
                    <div className="rounded-[20px] border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">Modo de substituição ativo. Os anexos atuais serão trocados pelos novos arquivos selecionados ao salvar.</div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {editingDocuments.map((document) => {
                        const decoded = decodeExamDocument(document);
                        return (
                          <div key={document} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                            <button type="button" onClick={() => decoded && openAttachmentPreview({ name: decoded.name, type: decoded.type, dataUrl: decoded.dataUrl })} className="inline-flex items-center gap-2 transition-colors hover:text-foreground">
                              <Paperclip className="h-3.5 w-3.5" /> {decoded?.name ?? 'Arquivo anexado'}
                            </button>
                            <button type="button" onClick={() => removeExistingAttachment(document)} className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive transition-colors hover:bg-destructive/15">Remover</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {selectedFiles.length > 0 && (
                <div className="rounded-[28px] border border-border bg-muted/40 p-4">
                  <p className="mb-2 text-sm text-foreground">Novos arquivos selecionados</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${index}`} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-2"><Paperclip className="h-3.5 w-3.5" />{file.name}</span>
                        <button type="button" onClick={() => removeNewAttachment(index)} className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive transition-colors hover:bg-destructive/15">Remover</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={clearForm} className="rounded-[18px] border border-border bg-background px-4 py-3 text-muted-foreground transition-colors hover:bg-muted">Cancelar</button>
              <button type="submit" className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-4 py-3 text-white transition-colors hover:bg-primary/90">
                <Upload className="h-4 w-4" /> {editingId ? 'Atualizar Registro' : 'Salvar Registro'}
              </button>
            </div>
          </form>
        )}

        {petRecords.length === 0 ? (
          <div className="rounded-[34px] border border-border/70 bg-card p-8 text-center shadow-[0_24px_60px_-36px_rgba(127,162,106,0.18)]">
            <p className="text-muted-foreground">Nenhum evento médico registrado para este pet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {petRecords.map((record) => {
              const attachments = (record.documents ?? []).map((document) => ({ raw: document, meta: decodeExamDocument(document) }));

              return (
                <article key={record.id} className="rounded-[32px] border border-border/70 bg-card p-6 shadow-[0_18px_42px_-30px_rgba(127,162,106,0.2)]">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                      <Calendar className="h-4 w-4" />
                      <span className="font-medium text-foreground">{record.date}</span>
                      {record.clinicName && <span>{record.clinicName}</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => startEdit(record)} className="rounded-full border border-border bg-background p-2 text-muted-foreground transition-colors hover:bg-muted" title="Editar Registro"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => { if (confirm('Deseja excluir permanentemente este registro médico?')) void deleteMedicalRecord(record.id); }} className="rounded-full border border-border bg-background p-2 text-red-600 transition-colors hover:bg-red-50" title="Excluir Registro"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <p className="leading-relaxed text-foreground">{record.description}</p>
                    {record.treatment && (
                      <div className="rounded-[24px] border border-border bg-muted p-4">
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-primary"><ShieldAlert className="h-3.5 w-3.5" /> Tratamento Recomendado</p>
                        <p className="text-sm text-muted-foreground">{record.treatment}</p>
                      </div>
                    )}
                    {record.veterinarianName && <p className="text-xs text-muted-foreground">Veterinário: {record.veterinarianName}</p>}

                    {attachments.length > 0 && (
                      <div className="space-y-3 border-t border-border pt-3">
                        <p className="flex items-center gap-2 text-sm text-foreground"><Paperclip className="h-4 w-4 text-primary" /> Anexos ({attachments.length})</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {attachments.map((attachment, index) => {
                            const decoded = attachment.meta;
                            const fileName = decoded?.name ?? 'Arquivo anexado';
                            const fileType = decoded?.type ?? 'Tipo nao informado';
                            const fileSize = decoded?.size ?? 0;

                            return (
                              <div key={attachment.raw} className="rounded-[24px] border border-border bg-muted/30 p-4">
                                <p className="break-words text-sm text-foreground">{fileName}</p>
                                <p className="mt-1 text-xs text-muted-foreground">{fileType} • {bytesToLabel(fileSize)}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button type="button" onClick={() => decoded && openAttachmentPreview({ name: fileName, type: fileType, dataUrl: decoded.dataUrl })} className="inline-flex items-center gap-2 rounded-[18px] border border-border bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"><Eye className="h-4 w-4" />Visualizar</button>
                                  <a href={decoded?.dataUrl ?? attachment.raw} download={fileName} className="inline-flex items-center gap-2 rounded-[18px] bg-primary px-3 py-2 text-sm text-white transition-colors hover:bg-primary/90"><Download className="h-4 w-4" />Baixar</a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" onClick={() => setPreviewAttachment(null)}>
          <div className="w-full max-w-4xl overflow-hidden rounded-[32px] border border-border bg-card shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h3 className="text-lg text-foreground">{previewAttachment.name}</h3>
                <p className="text-xs text-muted-foreground">{previewAttachment.type}</p>
              </div>
              <button type="button" onClick={() => setPreviewAttachment(null)} className="rounded-full border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted">Fechar</button>
            </div>
            <div className="max-h-[80vh] bg-muted/30 p-4">
              {previewAttachment.type.startsWith('image/') ? (
                <img src={previewAttachment.dataUrl} alt={previewAttachment.name} className="mx-auto max-h-[75vh] w-auto max-w-full rounded-[24px] border border-border bg-background object-contain" />
              ) : (
                <iframe src={previewAttachment.dataUrl} title={previewAttachment.name} className="h-[75vh] w-full rounded-[24px] border border-border bg-background" />
              )}
            </div>
          </div>
        </div>
      )}
    </TutorShell>
  );
}


