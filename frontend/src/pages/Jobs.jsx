import React, { useState } from 'react';
import { useQuery, useMutation } from 'react-query';
import { Link } from 'react-router-dom';
import { jobsAPI } from '../services/api';
import { Search, Filter, MapPin, DollarSign, Calendar, ExternalLink, Briefcase, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const Jobs = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [scrapeKeywords, setScrapeKeywords] = useState('');
  const [scrapeLocation, setScrapeLocation] = useState('');
  const [filters, setFilters] = useState({
    location: '',
    salary: '',
    experience: '',
    jobType: '',
  });
  const [showFilters, setShowFilters] = useState(false);

  const { data: jobsData, isLoading, refetch } = useQuery(
    ['jobs', searchTerm, filters],
    () => jobsAPI.getJobs({
      search: searchTerm,
      ...filters,
    }),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      enabled: true,
    }
  );

  const jobs = jobsData?.data?.jobs || [];

  const scrapeMutation = useMutation(
    (data) => jobsAPI.scrapeJobs(data),
    {
      onSuccess: (response) => {
        toast.success(`Found ${response.data.totalFound} jobs!`);
        refetch();
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to scrape jobs');
      },
    }
  );

  const handleScrape = () => {
    if (!scrapeKeywords) {
      toast.error('Please enter keywords');
      return;
    }
    scrapeMutation.mutate({ keywords: scrapeKeywords, location: scrapeLocation });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    refetch();
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const formatSalary = (salary) => {
    if (!salary) return 'Not specified';
    return salary.includes('-') ? salary : `$${salary}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Job Opportunities</h1>
          <p className="text-gray-600 mt-1">
            Discover and apply to the best job opportunities
          </p>
        </div>
        <button
          onClick={() => document.getElementById('scrapeModal').showModal()}
          className="btn btn-primary"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          AI Scrape Jobs
        </button>
      </div>

      {/* Scrape Modal */}
      <dialog id="scrapeModal" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg mb-4">AI Job Scrape</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Keywords (e.g., JavaScript, Python, Designer)
              </label>
              <input
                type="text"
                value={scrapeKeywords}
                onChange={(e) => setScrapeKeywords(e.target.value)}
                placeholder="Enter job keywords"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location (optional)
              </label>
              <input
                type="text"
                value={scrapeLocation}
                onChange={(e) => setScrapeLocation(e.target.value)}
                placeholder="City or Remote"
                className="input w-full"
              />
            </div>
          </div>
          <div className="modal-action">
            <form method="dialog">
              <button className="btn btn-ghost">Cancel</button>
            </form>
            <button
              onClick={handleScrape}
              disabled={scrapeMutation.isLoading}
              className="btn btn-primary"
            >
              {scrapeMutation.isLoading ? 'Scraping...' : 'Start Scraping'}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Search Bar */}
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
                placeholder="Search jobs, companies, or keywords..."
                className="input pl-10"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className="btn btn-outline"
              >
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </button>
              <button
                type="submit"
                className="btn btn-primary"
              >
                Search Jobs
              </button>
            </div>
          </form>

          {/* Filters */}
          {showFilters && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={filters.location}
                    onChange={(e) => handleFilterChange('location', e.target.value)}
                    placeholder="City, State, or Remote"
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Salary Range
                  </label>
                  <select
                    value={filters.salary}
                    onChange={(e) => handleFilterChange('salary', e.target.value)}
                    className="select"
                  >
                    <option value="">Any</option>
                    <option value="0-50000">$0 - $50,000</option>
                    <option value="50000-75000">$50,000 - $75,000</option>
                    <option value="75000-100000">$75,000 - $100,000</option>
                    <option value="100000+">$100,000+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Experience Level
                  </label>
                  <select
                    value={filters.experience}
                    onChange={(e) => handleFilterChange('experience', e.target.value)}
                    className="select"
                  >
                    <option value="">Any</option>
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid Level</option>
                    <option value="senior">Senior Level</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Type
                  </label>
                  <select
                    value={filters.jobType}
                    onChange={(e) => handleFilterChange('jobType', e.target.value)}
                    className="select"
                  >
                    <option value="">Any</option>
                    <option value="full-time">Full Time</option>
                    <option value="part-time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="loading-spinner"></div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">
          <Briefcase className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
          <p className="text-gray-600">
            Try adjusting your search terms or filters to find more opportunities.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {jobs.map((job) => (
            <div key={job._id} className="card hover:shadow-lg transition-shadow duration-200">
              <div className="card-body">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {job.title}
                      </h3>
                      {job.isRemote && (
                        <span className="badge badge-info">Remote</span>
                      )}
                    </div>
                    <p className="text-lg text-blue-600 font-medium mb-2">
                      {job.company}
                    </p>
                    <p className="text-gray-600 mb-4">
                      {job.description.substring(0, 200)}...
                    </p>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
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
                          <span>{formatDate(job.postedDate)}</span>
                        </div>
                      )}
                    </div>

                    {job.tags && job.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
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

                    <div className="flex items-center space-x-3">
                      <Link
                        to={`/jobs/${job._id}`}
                        className="btn btn-primary"
                      >
                        View Details
                      </Link>
                      {job.url && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-outline"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Apply on Site
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Jobs;