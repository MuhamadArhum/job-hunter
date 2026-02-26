import React, { useState } from 'react';
import { X, Check, XCircle, Eye, ChevronDown, ChevronUp, AlertTriangle, Send } from 'lucide-react';
import { orchestratorApi } from '../../services/orchestratorApi';
import { pipelineApi } from '../../services/pipelineApi';
import toast from 'react-hot-toast';

// ─── CV Review (Pipeline HITL 1) ──────────────────────────────────────────────
const CVReviewContent = ({ content }) => {
  const [openIdx, setOpenIdx] = useState(0);
  const cvs = content?.original?.cvs || [];

  if (cvs.length === 0) return <p className="text-sm text-gray-500">No CVs to review.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
        Review each AI-tailored CV below. Click "Approve CVs" to proceed to email drafting.
      </p>
      {cvs.map((item, idx) => (
        <div key={item.jobId} className={`border rounded-xl overflow-hidden ${item.error ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
            onClick={() => setOpenIdx(openIdx === idx ? -1 : idx)}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex-shrink-0 text-base">{item.error ? '❌' : '📄'}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{item.jobTitle}</p>
                <p className="text-xs text-gray-500 truncate">{item.company}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.atsScore && (
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                  (item.atsScore.overall || 0) >= 80 ? 'bg-emerald-100 text-emerald-700' :
                  (item.atsScore.overall || 0) >= 60 ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  ATS {item.atsScore.overall || '?'}%
                </span>
              )}
              {openIdx === idx ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </div>
          </button>

          {openIdx === idx && (
            <div className="border-t px-4 py-3 bg-white space-y-3">
              {item.error ? (
                <p className="text-xs text-red-600">Generation failed: {item.error}</p>
              ) : (
                <>
                  {item.atsScore && (
                    <div className="grid grid-cols-3 gap-2">
                      {[['Format', item.atsScore.format], ['Keywords', item.atsScore.keywords], ['Content', item.atsScore.content]].map(([label, val]) => (
                        <div key={label} className="rounded-lg p-2 text-center border bg-gray-50">
                          <p className="text-lg font-bold text-gray-800">{val || '—'}</p>
                          <p className="text-xs text-gray-500">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {item.cv?.sections?.summary && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Summary</p>
                      <p className="text-xs text-gray-700">{item.cv.sections.summary}</p>
                    </div>
                  )}
                  {(item.cv?.matchedKeywords || []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Matched Keywords</p>
                      <div className="flex flex-wrap gap-1">
                        {item.cv.matchedKeywords.slice(0, 8).map(kw => (
                          <span key={kw} className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {(item.cv?.missingKeywords || []).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Missing Keywords</p>
                      <div className="flex flex-wrap gap-1">
                        {item.cv.missingKeywords.slice(0, 5).map(kw => (
                          <span key={kw} className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{kw}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {item.cv?.suggestions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Suggestions</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {item.cv.suggestions.slice(0, 3).map((s, i) => (
                          <li key={i} className="text-xs text-gray-600">{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Pipeline Email Review (HITL 2) ───────────────────────────────────────────
const PipelineEmailContent = ({ content, emails, setEmails }) => {
  const [openIdx, setOpenIdx] = useState(0);
  const emailList = emails || content?.original?.emails || [];

  const updateEmail = (idx, field, value) => {
    const updated = [...emailList];
    updated[idx] = { ...updated[idx], [field]: value };
    setEmails(updated);
  };

  if (emailList.length === 0) return <p className="text-sm text-gray-500">No emails to review.</p>;

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700">
          These will be sent to real HR contacts. Edit any email below before approving.
        </p>
      </div>

      {emailList.map((email, idx) => (
        <div key={email.jobId || idx} className={`border rounded-xl overflow-hidden ${email.error ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
            onClick={() => setOpenIdx(openIdx === idx ? -1 : idx)}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">
                {email.company} — {email.jobTitle}
              </p>
              <p className="text-xs text-gray-500 truncate">→ {email.hrEmail}</p>
            </div>
            {openIdx === idx ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {openIdx === idx && (
            <div className="border-t px-4 py-3 bg-white space-y-3">
              {email.error ? (
                <p className="text-xs text-red-600">Failed: {email.error}</p>
              ) : (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">To (HR Email)</label>
                    <input
                      type="text"
                      value={email.hrEmail || ''}
                      onChange={e => updateEmail(idx, 'hrEmail', e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Subject</label>
                    <input
                      type="text"
                      value={email.subject || ''}
                      onChange={e => updateEmail(idx, 'subject', e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase">Body</label>
                    <textarea
                      value={email.body || ''}
                      onChange={e => updateEmail(idx, 'body', e.target.value)}
                      rows={8}
                      className="w-full mt-1 px-3 py-1.5 border rounded-lg text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Main ApprovalModal ────────────────────────────────────────────────────────
const ApprovalModal = ({ approval, onClose, onApproved }) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modifiedContent, setModifiedContent] = useState(
    approval?.content?.modified ? { ...approval.content.modified } : {}
  );
  const [emailsState, setEmailsState] = useState(null);

  if (!approval) return null;

  const { content, title, description, approvalType } = approval;
  const pipelineId = content?.original?.pipelineId;
  const isPipelineCVReview = approvalType === 'cv_review';
  const isPipelineEmail = approvalType === 'email_send' && !!pipelineId;
  const isSingleEmail = approvalType === 'email_send' && !pipelineId;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      if (isPipelineCVReview) {
        await pipelineApi.approveCVs(pipelineId, approval.approvalId);
        toast.success('CVs approved! AI is drafting application emails...');
      } else if (isPipelineEmail) {
        const emails = emailsState || content?.original?.emails || [];
        await pipelineApi.approveEmails(pipelineId, approval.approvalId, emails);
        toast.success('Applications sent successfully!');
      } else {
        await orchestratorApi.approve(approval.approvalId, 'approved', null, comment);
        toast.success('Approved!');
      }
      onApproved?.();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to approve');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      if (isPipelineCVReview || isPipelineEmail) {
        await pipelineApi.reject(pipelineId, approval.approvalId);
        toast.success('Pipeline cancelled.');
      } else {
        await orchestratorApi.approve(approval.approvalId, 'rejected', null, comment);
        toast.success('Rejected.');
      }
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to reject');
    } finally {
      setIsSubmitting(false);
    }
  };

  const approveLabel = isPipelineCVReview ? 'Approve CVs & Draft Emails'
    : isPipelineEmail ? 'Send Applications'
    : 'Approve';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-amber-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <Eye className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">
                {isPipelineCVReview ? '📋 Review Generated CVs'
                  : isPipelineEmail ? '📧 Review Application Emails'
                  : 'Approval Required'}
              </h3>
              <p className="text-sm text-gray-600 truncate max-w-xs">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Description + type badge */}
        <div className="px-4 py-3 border-b flex-shrink-0">
          <p className="text-sm text-gray-600">{description}</p>
          <span className={`mt-2 inline-block px-2 py-1 rounded text-xs font-medium ${
            approvalType === 'cv_review' ? 'bg-purple-100 text-purple-700' :
            approvalType === 'email_send' ? 'bg-green-100 text-green-700' :
            'bg-gray-100 text-gray-700'
          }`}>
            {approvalType.replace(/_/g, ' ').toUpperCase()}
          </span>
        </div>

        {/* Content preview */}
        <div className="flex-1 overflow-y-auto p-4">
          {isPipelineCVReview && <CVReviewContent content={content} />}
          {isPipelineEmail && (
            <PipelineEmailContent content={content} emails={emailsState} setEmails={setEmailsState} />
          )}
          {isSingleEmail && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                Edit the email below before approving.
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">To</label>
                <input type="text" value={modifiedContent.to ?? content?.modified?.to ?? ''} onChange={e => setModifiedContent(p => ({ ...p, to: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Subject</label>
                <input type="text" value={modifiedContent.subject ?? content?.modified?.subject ?? ''} onChange={e => setModifiedContent(p => ({ ...p, subject: e.target.value }))} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Body</label>
                <textarea value={modifiedContent.body ?? content?.modified?.body ?? ''} onChange={e => setModifiedContent(p => ({ ...p, body: e.target.value }))} rows={10} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
          {!isPipelineCVReview && !isPipelineEmail && !isSingleEmail && (
            <pre className="p-4 bg-gray-50 rounded-lg text-xs overflow-auto max-h-64">
              {JSON.stringify(content?.modified || content?.original, null, 2)}
            </pre>
          )}
        </div>

        {/* Comment (non-pipeline only) */}
        {!isPipelineCVReview && !isPipelineEmail && (
          <div className="px-4 py-3 border-t flex-shrink-0">
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Comment (optional)..."
              rows={2}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        )}

        {/* Actions */}
        <div className="p-4 border-t bg-gray-50 flex justify-between flex-shrink-0">
          <button
            onClick={handleReject}
            disabled={isSubmitting}
            className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 text-sm"
          >
            <XCircle className="w-4 h-4" />
            {isPipelineCVReview || isPipelineEmail ? 'Cancel Pipeline' : 'Reject'}
          </button>
          <button
            onClick={handleApprove}
            disabled={isSubmitting}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2 disabled:opacity-50 text-sm font-medium"
          >
            {isSubmitting
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : isPipelineEmail ? <Send className="w-4 h-4" /> : <Check className="w-4 h-4" />
            }
            {approveLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApprovalModal;
