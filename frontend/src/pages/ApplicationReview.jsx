import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { useForm } from 'react-hook-form';
import { jobsAPI, coverLetterAPI, emailAPI, applicationsAPI } from '../services/api';
import { ArrowLeft, Eye, Send, Edit3, Save, X, CheckCircle, FileText, Mail, User } from 'lucide-react';
import toast from 'react-hot-toast';

const ApplicationReview = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [isSendingApplication, setIsSendingApplication] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [showCoverLetter, setShowCoverLetter] = useState(true);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const { data: jobData, isLoading: jobLoading } = useQuery(
    ['job', jobId],
    () => jobsAPI.getJobById(jobId),
    {
      enabled: !!jobId,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const job = jobData?.data?.job;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      emailSubject: '',
      emailBody: '',
      coverLetter: '',
      additionalNotes: '',
    },
  });

  useEffect(() => {
    if (job) {
      const defaultSubject = `Application for ${job.title} - ${job.company}`;
      const defaultBody = `Dear Hiring Manager,\n\nI am writing to express my interest in the ${job.title} position at ${job.company}. Please find my application and cover letter attached.\n\nBest regards,\n[Your Name]`;
      
      setEmailSubject(defaultSubject);
      setEmailBody(defaultBody);
      setValue('emailSubject', defaultSubject);
      setValue('emailBody', defaultBody);
    }
  }, [job, setValue]);

  const handleGenerateCoverLetter = async () => {
    setIsGeneratingCoverLetter(true);
    try {
      const response = await coverLetterAPI.generate({
        jobId: jobId,
        jobTitle: job.title,
        company: job.company,
        description: job.description,
      });
      
      setCoverLetter(response.data.coverLetter);
      setValue('coverLetter', response.data.coverLetter);
      toast.success('Cover letter generated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to generate cover letter');
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  const handleSendApplication = async (data) => {
    if (!job.email) {
      toast.error('No email address found for this job posting');
      return;
    }

    setIsSendingApplication(true);
    try {
      const response = await emailAPI.sendApplication({
        jobId: jobId,
        to: job.email,
        subject: data.emailSubject,
        body: data.emailBody,
        coverLetter: coverLetter || data.coverLetter,
        additionalNotes: data.additionalNotes,
      });
      
      toast.success('Application sent successfully!');
      navigate('/applications');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send application');
    } finally {
      setIsSendingApplication(false);
    }
  };

  const handleSaveDraft = async (data) => {
    try {
      // Save as draft application
      await applicationsAPI.createApplication({
        jobId: jobId,
        status: 'pending',
        coverLetter: coverLetter || data.coverLetter,
        additionalNotes: data.additionalNotes,
      });
      
      toast.success('Application saved as draft!');
      navigate('/applications');
    } catch (error) {
      toast.error('Failed to save draft');
    }
  };

  if (jobLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Job not found</h2>
          <button
            onClick={() => navigate('/jobs')}
            className="btn btn-primary"
          >
            Browse Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/jobs')}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Back to Jobs</span>
        </button>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSubmit(handleSaveDraft)}
            className="btn btn-secondary"
          >
            Save as Draft
          </button>
          <button
            onClick={handleSubmit(handleSendApplication)}
            disabled={isSendingApplication || !coverLetter}
            className="btn btn-primary"
          >
            {isSendingApplication ? (
              <>
                <div className="loading-spinner mr-2"></div>
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Application
              </>
            )}
          </button>
        </div>
      </div>

      {/* Job Summary */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Job Summary</h2>
        </div>
        <div className="card-body">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{job.title}</h3>
          <p className="text-lg text-blue-600 font-medium mb-4">{job.company}</p>
          {job.location && (
            <p className="text-gray-600 mb-2">
              <strong>Location:</strong> {job.location}
            </p>
          )}
          {job.salary && (
            <p className="text-gray-600 mb-2">
              <strong>Salary:</strong> {job.salary}
            </p>
          )}
          <div className="mt-4">
            <p className="text-gray-700">
              <strong>Description:</strong>
            </p>
            <p className="text-gray-600 mt-2">
              {job.description.substring(0, 300)}...
            </p>
          </div>
        </div>
      </div>

      {/* Cover Letter */}
      <div className="card">
        <div className="card-header">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Cover Letter</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowCoverLetter(!showCoverLetter)}
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-900"
              >
                <Eye className="h-4 w-4" />
                <span>{showCoverLetter ? 'Hide' : 'Show'}</span>
              </button>
              {!coverLetter && (
                <button
                  onClick={handleGenerateCoverLetter}
                  disabled={isGeneratingCoverLetter}
                  className="btn btn-outline"
                >
                  {isGeneratingCoverLetter ? (
                    <>
                      <div className="loading-spinner mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate with AI
                    </>
                  )}
                </button>
              )}
              {coverLetter && (
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="btn btn-outline"
                >
                  {isEditing ? (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </>
                  ) : (
                    <>
                      <Edit3 className="h-4 w-4 mr-2" />
                      Edit
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
        {showCoverLetter && (
          <div className="card-body">
            {coverLetter ? (
              <div className="space-y-4">
                <textarea
                  {...register('coverLetter')}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  disabled={!isEditing}
                  rows={10}
                  className={`textarea ${!isEditing ? 'bg-gray-50' : ''}`}
                  placeholder="Your cover letter will appear here..."
                />
                {!isEditing && (
                  <div className="flex space-x-3">
                    <button
                      onClick={() => navigator.clipboard.writeText(coverLetter)}
                      className="btn btn-outline"
                    >
                      Copy to Clipboard
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">
                  No cover letter generated yet. Click "Generate with AI" to create one.
                </p>
                <button
                  onClick={handleGenerateCoverLetter}
                  disabled={isGeneratingCoverLetter}
                  className="btn btn-primary"
                >
                  {isGeneratingCoverLetter ? (
                    <>
                      <div className="loading-spinner mr-2"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Generate Cover Letter
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Email Details */}
      <form onSubmit={handleSubmit(handleSendApplication)} className="space-y-6">
        <div className="card">
          <div className="card-header">
            <div className="flex items-center space-x-2">
              <Mail className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">Email Details</h2>
            </div>
          </div>
          <div className="card-body space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To
              </label>
              <input
                type="email"
                value={job.email || 'No email provided'}
                disabled
                className="input bg-gray-50"
              />
              {!job.email && (
                <p className="mt-1 text-sm text-red-600">
                  This job posting doesn't have an email address. You may need to apply directly on their website.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subject *
              </label>
              <input
                {...register('emailSubject', { required: 'Subject is required' })}
                type="text"
                className={`input ${errors.emailSubject ? 'border-red-500' : ''}`}
                placeholder="Enter email subject"
              />
              {errors.emailSubject && (
                <p className="mt-1 text-sm text-red-600">{errors.emailSubject.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Body *
              </label>
              <textarea
                {...register('emailBody', { required: 'Email body is required' })}
                rows={8}
                className={`textarea ${errors.emailBody ? 'border-red-500' : ''}`}
                placeholder="Write your email message..."
              />
              {errors.emailBody && (
                <p className="mt-1 text-sm text-red-600">{errors.emailBody.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Notes (Optional)
              </label>
              <textarea
                {...register('additionalNotes')}
                rows={3}
                className="textarea"
                placeholder="Any additional notes or instructions..."
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/jobs')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSendingApplication || !job.email || !coverLetter}
            className="btn btn-primary"
          >
            {isSendingApplication ? (
              <>
                <div className="loading-spinner mr-2"></div>
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Application
              </>
            )}
          </button>
        </div>
      </form>

      {/* Preview Modal */}
      {showCoverLetter && coverLetter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Cover Letter Preview</h2>
              <button
                onClick={() => setShowCoverLetter(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {coverLetter}
                </pre>
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(coverLetter);
                  toast.success('Cover letter copied to clipboard');
                }}
                className="btn btn-outline"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowCoverLetter(false)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationReview;