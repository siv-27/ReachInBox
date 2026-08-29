import React, { useState, type ChangeEvent, type FormEvent } from 'react';
import { Modal } from './Modal';
import { Input } from '../Input/Input';
import { Textarea } from '../Input/Textarea';
import { FileInput } from '../Input/FileInput';
import { Button } from '../Button/Button';
import { campaignService } from '../../services/campaignService';
import { useAuth } from '../../hooks/useAuth';

export interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (type: 'success' | 'error', message: string) => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  showToast,
}) => {
  const { user } = useAuth();

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [startTime, setStartTime] = useState('');
  const [delay, setDelay] = useState(0);
  const [hourlyLimit, setHourlyLimit] = useState(200);

  const [csvEmails, setCsvEmails] = useState<string[]>([]);
  const [invalidEmailsCount, setInvalidEmailsCount] = useState(0);
  const [fileDetails, setFileDetails] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const resetForm = () => {
    setSubject('');
    setBody('');
    setStartTime('');
    setDelay(0);
    setHourlyLimit(200);
    setCsvEmails([]);
    setInvalidEmailsCount(0);
    setFileDetails(null);
    setModalError(null);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileDetails(`${file.name} (${(file.size / 1024).toFixed(1)} KB)`);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || '';
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const validSet = new Set<string>();
      let invalidCount = 0;

      if (lines.length > 0) {
        // Detect CSV header names if present
        const headerRow = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
        const possibleHeaders = ['email', 'email address', 'emailaddress', 'recipient', 'recipientemail', 'to'];
        const emailColIndex = headerRow.findIndex((col) => possibleHeaders.includes(col));

        const startIdx = emailColIndex !== -1 ? 1 : 0;

        for (let i = startIdx; i < lines.length; i++) {
          const rawLine = lines[i];
          const tokens = rawLine.split(/[\n,]/).map((t) => t.trim().replace(/^["']|["']$/g, ''));

          for (const token of tokens) {
            if (!token) continue;
            if (possibleHeaders.includes(token.toLowerCase())) continue;

            if (emailRegex.test(token)) {
              validSet.add(token.toLowerCase());
            } else {
              invalidCount++;
            }
          }
        }
      }

      const validList = Array.from(validSet);
      setCsvEmails(validList);
      setInvalidEmailsCount(invalidCount);
      setModalError(null);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!subject.trim()) {
      setModalError('Subject line is required.');
      return;
    }
    if (!body.trim()) {
      setModalError('Email body context is required.');
      return;
    }
    if (csvEmails.length === 0) {
      setModalError('Please upload a file containing at least one valid recipient email.');
      return;
    }
    if (!startTime) {
      setModalError('Schedule start date and time is required.');
      return;
    }

    const startDate = new Date(startTime);
    const startTimestamp = startDate.getTime();

    if (isNaN(startTimestamp)) {
      setModalError('Invalid start date and time format.');
      return;
    }

    // Convert local datetime-local selection to explicit ISO 8601 UTC timestamp string
    const isoStartTime = startDate.toISOString();

    if (startTimestamp < Date.now() - 5000) {
      setModalError('Start time must be in the future.');
      return;
    }

    setLoading(true);
    setModalError(null);

    try {
      await campaignService.scheduleCampaign({
        sender: user?.email || 'sender@example.com',
        recipients: csvEmails,
        subject,
        body,
        startTime: isoStartTime,
        delayBetweenEmails: delay * 1000,
        hourlyLimit,
      });

      showToast('success', `${csvEmails.length} emails scheduled successfully!`);
      onClose();
      resetForm();
      onSuccess();
    } catch (err: any) {
      console.error('[ComposeModal] Scheduling failed:', err);
      setModalError(err.response?.data?.message || 'Failed to schedule outreach. Please verify input fields.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        onClose();
        resetForm();
      }}
      title="Compose Outreach"
      errorMessage={modalError}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          label="Subject Line"
          placeholder="e.g. Partnership Inquiry or Meet Outreach Team"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          required
        />

        <Textarea
          label="Email Content Body"
          placeholder="Type outreach content here..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          required
        />

        <FileInput
          onChange={handleFileUpload}
          fileDetails={fileDetails}
          validCount={csvEmails.length}
          invalidCount={invalidEmailsCount}
        />

        <Input
          type="datetime-local"
          label="Outreach Launch Time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            type="number"
            min={0}
            label="Send Stagger (Seconds)"
            value={delay}
            onChange={(e) => setDelay(parseInt(e.target.value) || 0)}
            placeholder="e.g. 5"
          />
          <Input
            type="number"
            min={1}
            label="Hourly Rate Limit"
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(parseInt(e.target.value) || 1)}
            placeholder="e.g. 200"
          />
        </div>

        {modalError && (
          <div className="bg-[#FFF7ED] border border-[#FFEDD5] text-[#B91C1C] p-3 rounded-lg text-xs flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B91C1C] inline-block shrink-0" />
            <span>{modalError}</span>
          </div>
        )}

        <div className="pt-4 border-t border-[#EEE7DF] flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClose();
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={loading}>
            Schedule Outreach
          </Button>
        </div>
      </form>
    </Modal>
  );
};
