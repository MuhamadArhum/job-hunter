import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { jobsAPI, coverLetterAPI } from '../services/api';
import { ArrowLeft, MapPin, DollarSign, Calendar, ExternalLink, FileText, Send, Eye, Loader } from 'lucide-react';
import toast from 'react-hot-toast';

const JobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [showCoverLetter, setShowCoverLetter] = useState(false);

  const { data: jobData, isLoading } = useQuery(
    ['job', id],
    () => jobsAPI.getJobById(id),
    {
      enabled: !!id,
      staleTime: 5 * 60 * 1000, // 5 minutes
    }
  );

  const job = jobData?.data?.job;

  const handleGenerateCoverLetter = async () => {
    setIsGeneratingCoverLetter(true);
    try {
      const response = await coverLetterAPI.generate({
        jobDescription: job.description,
        jobTitle: job.title,
        companyName: job.company,
      });
      
      setCoverLetter(response.data.coverLetter);
      setShowCoverLetter(true);
      toast.success('Cover letter generated successfully!');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to generate cover letter');
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  const handleApplyNow = () => {
    navigate(`/review/${id}`);
  };

  const formatSalary = (salary) => {
    if (!salary) return 'Not specified';
    return salary.includes('-') ? salary : `$${salary}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
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
      </div>

      {/* Job Header */}
      <div className="card">
        <div className="card-body">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center space-x-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  {job.title}
                </h1>
                {job.isRemote && (
                  <span className="badge badge-info">Remote</span>
                )}
              </div>
              <p className="text-xl text-blue-600 font-medium">
                {job.company}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-6">
            {job.location && (
              <div className="flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span>{job.location}</span>
              </div>
            )}
            {job.salary && (
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4" />
                <span>{formatSalary(job.salary)}</span>
              </div>
            )}
            {job.postedDate && (
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>Posted {formatDate(job.postedDate)}</span>
              </div>
            )}
          </div>

          {job.tags && job.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {job.tags.map((tag, index) => (
                <span
                  key={index}
                  className="badge badge-gray"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center space-x-4">
            <button
              onClick={handleApplyNow}
              className="btn btn-primary"
            >
              <Send className="h-4 w-4 mr-2" />
              Apply Now
            </button>
            
            <button
              onClick={handleGenerateCoverLetter}
              disabled={isGeneratingCoverLetter}
              className="btn btn-outline"
            >
              {isGeneratingCoverLetter ? (
                <>
                  <Loader className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Cover Letter
                </>
              )}
            </button>

            {job.url && (
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View on Site
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Cover Letter Preview */}
      {showCoverLetter && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Generated Cover Letter</h2>
              <button
                onClick={() => setShowCoverLetter(!showCoverLetter)}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <Eye className="h-4 w-4" />
                <span>{showCoverLetter ? 'Hide' : 'Show'}</span>
              </button>
            </div>
          </div>
          {showCoverLetter && (
            <div className="card-body">
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {coverLetter}
                </pre>
              </div>
              <div className="mt-6 flex space-x-4">
                <button
                  onClick={() => navigator.clipboard.writeText(coverLetter)}
                  className="btn btn-outline"
                >
                  Copy to Clipboard
                </button>
                <button
                  onClick={handleApplyNow}
                  className="btn btn-primary"
                >
                  Use This Cover Letter
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Job Description */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-semibold text-gray-900">Job Description</h2>
        </div>
        <div className="card-body">
          <div className="prose max-w-none">
            <pre className="whitespace-pre-wrap font-sans text-gray-700">
              {job.description}
            </pre>
          </div>
        </div>
      </div>

      {/* Requirements */}
      {job.requirements && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Requirements</h2>
          </div>
          <div className="card-body">
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-gray-700">
                {job.requirements}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Benefits */}
      {job.benefits && (
        <div className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold text-gray-900">Benefits</h2>
          </div>
          <div className="card-body">
            <div className="prose max-w-none">
              <pre className="whitespace-pre-wrap font-sans text-gray-700">
                {job.benefits}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobDetails;