import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, Transition } from '@headlessui/react';
import { 
  ShieldCheckIcon, 
  ExclamationTriangleIcon, 
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface ContentPolicy {
  projectId: string;
  ageRating: 'G' | 'PG' | 'PG-13' | 'R' | 'NC-17';
  themes: string[];
  tone: 'family' | 'mature' | 'dark' | 'lighthearted';
  violenceLevel: 'none' | 'mild' | 'moderate' | 'high';
  languageLevel: 'clean' | 'mild' | 'moderate' | 'strong';
  sexualContent: 'none' | 'mild' | 'moderate' | 'explicit';
  drugContent: 'none' | 'mild' | 'moderate' | 'explicit';
  politicalContent: 'none' | 'mild' | 'moderate' | 'explicit';
  customFilters: string[];
  autoReviewThreshold: number;
}

interface ContentReview {
  id: string;
  contentId: string;
  contentType: 'story' | 'quest' | 'dialogue' | 'lore' | 'character';
  content: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  violations: string[];
  warnings: string[];
  reviewReason?: string;
  submittedBy: string;
  isAIGenerated: boolean;
  createdAt: string;
  reviewerId?: string;
  reviewNotes?: string;
}

interface ContentPolicyManagerProps {
  projectId: string;
  onPolicyUpdate?: (policy: ContentPolicy) => void;
  onReviewUpdate?: (review: ContentReview) => void;
}

const policyFormSchema = z.object({
  ageRating: z.enum(['G', 'PG', 'PG-13', 'R', 'NC-17']),
  themes: z.array(z.string()).min(1, 'At least one theme is required'),
  tone: z.enum(['family', 'mature', 'dark', 'lighthearted']),
  violenceLevel: z.enum(['none', 'mild', 'moderate', 'high']),
  languageLevel: z.enum(['clean', 'mild', 'moderate', 'strong']),
  sexualContent: z.enum(['none', 'mild', 'moderate', 'explicit']),
  drugContent: z.enum(['none', 'mild', 'moderate', 'explicit']),
  politicalContent: z.enum(['none', 'mild', 'moderate', 'explicit']),
  customFilters: z.array(z.string()),
  autoReviewThreshold: z.number().min(1).max(10),
});

type PolicyFormData = z.infer<typeof policyFormSchema>;

const ContentPolicyManager: React.FC<ContentPolicyManagerProps> = ({
  projectId,
  onPolicyUpdate,
  onReviewUpdate,
}) => {
  const [policy, setPolicy] = useState<ContentPolicy | null>(null);
  const [reviews, setReviews] = useState<ContentReview[]>([]);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<ContentReview | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PolicyFormData>({
    resolver: zodResolver(policyFormSchema),
  });

  useEffect(() => {
    loadPolicy();
    loadReviewQueue();
  }, [projectId]);

  const loadPolicy = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/content-policy/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setPolicy(data);
        reset(data);
      }
    } catch (error) {
      console.error('Failed to load content policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReviewQueue = async () => {
    try {
      const response = await fetch(`/api/content-policy/projects/${projectId}/review-queue`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data);
      }
    } catch (error) {
      console.error('Failed to load review queue:', error);
    }
  };

  const onSubmitPolicy = async (data: PolicyFormData) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/content-policy/projects/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const updatedPolicy = await response.json();
        setPolicy(updatedPolicy);
        setIsPolicyModalOpen(false);
        onPolicyUpdate?.(updatedPolicy);
      }
    } catch (error) {
      console.error('Failed to update content policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (reviewId: string, status: 'approved' | 'rejected' | 'flagged', notes?: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/content-policy/reviews/${reviewId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: 'current-user-id', // This would come from auth context
          status,
          reviewNotes: notes,
        }),
      });

      if (response.ok) {
        const updatedReview = await response.json();
        setReviews(reviews.map(r => r.id === reviewId ? updatedReview : r));
        setIsReviewModalOpen(false);
        setSelectedReview(null);
        onReviewUpdate?.(updatedReview);
      }
    } catch (error) {
      console.error('Failed to update review:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      case 'flagged':
        return <ExclamationTriangleIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'flagged':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Content Policy Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <ShieldCheckIcon className="h-5 w-5 mr-2" />
            Content Policy
          </h3>
          <button
            onClick={() => setIsPolicyModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {policy ? 'Edit Policy' : 'Create Policy'}
          </button>
        </div>

        {policy ? (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Age Rating:</span> {policy.ageRating}
            </div>
            <div>
              <span className="font-medium">Tone:</span> {policy.tone}
            </div>
            <div>
              <span className="font-medium">Violence Level:</span> {policy.violenceLevel}
            </div>
            <div>
              <span className="font-medium">Language Level:</span> {policy.languageLevel}
            </div>
            <div className="col-span-2">
              <span className="font-medium">Themes:</span> {policy.themes.join(', ')}
            </div>
            <div className="col-span-2">
              <span className="font-medium">Custom Filters:</span> {policy.customFilters.length > 0 ? policy.customFilters.join(', ') : 'None'}
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No content policy configured. Click "Create Policy" to set one up.</p>
        )}
      </div>

      {/* Review Queue Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900 flex items-center">
            <EyeIcon className="h-5 w-5 mr-2" />
            Review Queue ({reviews.length})
          </h3>
          <button
            onClick={loadReviewQueue}
            className="text-blue-600 hover:text-blue-700"
          >
            Refresh
          </button>
        </div>

        {reviews.length > 0 ? (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => {
                  setSelectedReview(review);
                  setIsReviewModalOpen(true);
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(review.status)}
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(review.status)}`}>
                      {review.status}
                    </span>
                    <span className="text-sm text-gray-500">
                      {review.contentType}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                  {review.content}
                </p>
                
                {review.violations.length > 0 && (
                  <div className="text-xs text-red-600">
                    Violations: {review.violations.join(', ')}
                  </div>
                )}
                
                {review.warnings.length > 0 && (
                  <div className="text-xs text-yellow-600">
                    Warnings: {review.warnings.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No content pending review.</p>
        )}
      </div>

      {/* Policy Configuration Modal */}
      <Transition show={isPolicyModalOpen} as={React.Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-50 overflow-y-auto"
          onClose={() => setIsPolicyModalOpen(false)}
        >
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <span className="inline-block h-screen align-middle" aria-hidden="true">
              &#8203;
            </span>

            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  Content Policy Configuration
                </Dialog.Title>

                <form onSubmit={handleSubmit(onSubmitPolicy)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Age Rating</label>
                      <select {...register('ageRating')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        <option value="G">G - General</option>
                        <option value="PG">PG - Parental Guidance</option>
                        <option value="PG-13">PG-13 - Parental Guidance 13+</option>
                        <option value="R">R - Restricted</option>
                        <option value="NC-17">NC-17 - Adults Only</option>
                      </select>
                      {errors.ageRating && <p className="text-red-500 text-xs">{errors.ageRating.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Tone</label>
                      <select {...register('tone')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        <option value="family">Family</option>
                        <option value="mature">Mature</option>
                        <option value="dark">Dark</option>
                        <option value="lighthearted">Lighthearted</option>
                      </select>
                      {errors.tone && <p className="text-red-500 text-xs">{errors.tone.message}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Violence Level</label>
                      <select {...register('violenceLevel')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        <option value="none">None</option>
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="high">High</option>
                      </select>
                      {errors.violenceLevel && <p className="text-red-500 text-xs">{errors.violenceLevel.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Language Level</label>
                      <select {...register('languageLevel')} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm">
                        <option value="clean">Clean</option>
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="strong">Strong</option>
                      </select>
                      {errors.languageLevel && <p className="text-red-500 text-xs">{errors.languageLevel.message}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Themes (comma-separated)</label>
                    <input
                      type="text"
                      {...register('themes')}
                      placeholder="fantasy, adventure, romance"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    />
                    {errors.themes && <p className="text-red-500 text-xs">{errors.themes.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Custom Filters (comma-separated)</label>
                    <input
                      type="text"
                      {...register('customFilters')}
                      placeholder="banned-word-1, banned-word-2"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Auto Review Threshold</label>
                    <input
                      type="number"
                      {...register('autoReviewThreshold', { valueAsNumber: true })}
                      min="1"
                      max="10"
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
                    />
                    {errors.autoReviewThreshold && <p className="text-red-500 text-xs">{errors.autoReviewThreshold.message}</p>}
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsPolicyModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save Policy'}
                    </button>
                  </div>
                </form>
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>

      {/* Review Modal */}
      <Transition show={isReviewModalOpen} as={React.Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-50 overflow-y-auto"
          onClose={() => setIsReviewModalOpen(false)}
        >
          <div className="min-h-screen px-4 text-center">
            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <span className="inline-block h-screen align-middle" aria-hidden="true">
              &#8203;
            </span>

            <Transition.Child
              as={React.Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <div className="inline-block w-full max-w-2xl p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
                {selectedReview && (
                  <>
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                      Review Content
                    </Dialog.Title>

                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-900">Content</h4>
                        <p className="mt-1 text-sm text-gray-700 bg-gray-50 p-3 rounded">
                          {selectedReview.content}
                        </p>
                      </div>

                      {selectedReview.violations.length > 0 && (
                        <div>
                          <h4 className="font-medium text-red-900">Violations</h4>
                          <ul className="mt-1 text-sm text-red-700">
                            {selectedReview.violations.map((violation, index) => (
                              <li key={index}>• {violation}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedReview.warnings.length > 0 && (
                        <div>
                          <h4 className="font-medium text-yellow-900">Warnings</h4>
                          <ul className="mt-1 text-sm text-yellow-700">
                            {selectedReview.warnings.map((warning, index) => (
                              <li key={index}>• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex justify-end space-x-3 pt-4">
                        <button
                          onClick={() => setIsReviewModalOpen(false)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleReviewAction(selectedReview.id, 'rejected')}
                          disabled={loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleReviewAction(selectedReview.id, 'approved')}
                          disabled={loading}
                          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default ContentPolicyManager;
