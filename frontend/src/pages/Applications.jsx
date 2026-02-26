import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { applicationsAPI } from '../services/api';
import { FileText, Search, Filter, Calendar, Eye, Trash2, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';

const Applications = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedApplication, setSelectedApplication] = useState(null);

  const { data: applicationsData, isLoading, refetch } = useQuery(
    ['applications', currentPage, searchTerm, statusFilter],
    () => applicationsAPI.getApplications({
      page: currentPage,
      limit: 10,
      search: searchTerm,
      status: statusFilter,
    }),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      keepPreviousData: true,
    }
  );

  const applications = applicationsData?.data?.applications || [];
  const pagination = applicationsData?.data?.pagination || {};

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    refetch();
  };

  const handleStatusChange = (status) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleDeleteApplication = async (applicationId) => {
    if (window.confirm('Are you sure you want to delete this application?')) {
      try {
        await applicationsAPI.deleteApplication(applicationId);
        toast.success('Application deleted successfully');
        refetch();
      } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to delete application');
      }
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { className: 'badge-warning', text: 'Pending' },
      sent: { className: 'badge-success', text: 'Sent' },
      failed: { className: 'badge-error', text: 'Failed' },
      rejected: { className: 'badge-error', text: 'Rejected' },
      interviewed: { className: 'badge-info', text: 'Interviewed' },
      hired: { className: 'badge-success', text: 'Hired' },
    };
    
    const config = statusConfig[status] || { className: 'badge-gray', text: status };
    return <span className={`badge ${config.className}`}>{config.text}</span>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const statusOptions = [
    { value: '', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'sent', label: 'Sent' },
    { value: 'failed', label: 'Failed' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'interviewed', label: 'Interviewed' },
    { value: 'hired', label: 'Hired' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Applications</h1>
        <p className="text-gray-600 mt-1">
          Track and manage all your job applications
        </p>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by job title or company..."
                className="input pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="select"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Applications List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="loading-spinner"></div>
        </div>
      ) : applications.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No applications yet</h3>
          <p className="text-gray-600 mb-4">
            Start applying to jobs to see them here.
          </p>
          <a href="/jobs" className="btn btn-primary">
            Browse Jobs
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((application) => (
            <div key={application._id} className="card hover:shadow-md transition-shadow duration-200">
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {application.job.title}
                      </h3>
                      <div className="flex items-center space-x-2">
                        {getStatusBadge(application.status)}
                        <button
                          onClick={() => handleDeleteApplication(application._id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete application"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-blue-600 font-medium mb-2">
                      {application.job.company}
                    </p>
                    
                    <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>Applied {formatDate(application.appliedAt)}</span>
                      </div>
                      {application.status === 'sent' && application.sentAt && (
                        <div className="flex items-center space-x-1">
                          <Send className="h-4 w-4" />
                          <span>Sent {formatDate(application.sentAt)}</span>
                        </div>
                      )}
                    </div>

                    {application.coverLetter && (
                      <div className="mt-3">
                        <button
                          onClick={() => setSelectedApplication(application)}
                          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
                        >
                          <FileText className="h-4 w-4" />
                          <span>View Cover Letter</span>
                        </button>
                      </div>
                    )}

                    {application.emailResponse && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <p className="text-sm text-gray-600">
                          <strong>Response:</strong> {application.emailResponse}
                        </p>
                      </div>
                    )}

                    {application.errorMessage && (
                      <div className="mt-3 p-3 bg-red-50 rounded-lg">
                        <p className="text-sm text-red-600">
                          <strong>Error:</strong> {application.errorMessage}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center">
          <nav className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="btn btn-outline disabled:opacity-50"
            >
              Previous
            </button>
            
            <span className="px-4 py-2 text-sm text-gray-700">
              Page {currentPage} of {pagination.totalPages}
            </span>
            
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === pagination.totalPages}
              className="btn btn-outline disabled:opacity-50"
            >
              Next
            </button>
          </nav>
        </div>
      )}

      {/* Cover Letter Modal */}
      {selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Cover Letter for {selectedApplication.job.title}
              </h2>
              <button
                onClick={() => setSelectedApplication(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="prose max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm">
                  {selectedApplication.coverLetter}
                </pre>
              </div>
            </div>
            <div className="flex justify-end space-x-3 p-6 border-t border-gray-200">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedApplication.coverLetter);
                  toast.success('Cover letter copied to clipboard');
                }}
                className="btn btn-outline"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setSelectedApplication(null)}
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

export default Applications;