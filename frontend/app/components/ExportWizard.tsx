"use client";

import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';

interface ExportWizardProps {
  projectId: string;
  onClose: () => void;
}

interface ExportFormat {
  value: string;
  name: string;
  description: string;
}

interface ExportType {
  value: string;
  name: string;
  description: string;
}

interface ExportValidation {
  ready: boolean;
  checks: Record<string, boolean>;
  warnings: string[];
  errors: string[];
}

interface ExportResponse {
  success: boolean;
  export_id: string;
  file_path: string;
  file_size: number;
  download_url?: string;
  metadata: any;
  warnings: string[];
  errors: string[];
}

const exportFormSchema = z.object({
  exportType: z.string().min(1, 'Export type is required'),
  format: z.string().min(1, 'Format is required'),
  includeMetadata: z.boolean().default(true),
  includeAssets: z.boolean().default(false),
  compression: z.boolean().default(false),
  customTemplate: z.string().optional(),
});

type ExportFormData = z.infer<typeof exportFormSchema>;

export default function ExportWizard({ projectId, onClose }: ExportWizardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [validation, setValidation] = useState<ExportValidation | null>(null);
  const [formats, setFormats] = useState<ExportFormat[]>([]);
  const [types, setTypes] = useState<ExportType[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [exportResult, setExportResult] = useState<ExportResponse | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'configure' | 'preview' | 'download'>('configure');

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
    reset
  } = useForm<ExportFormData>({
    resolver: zodResolver(exportFormSchema),
    defaultValues: {
      exportType: 'story_graph',
      format: 'json',
      includeMetadata: true,
      includeAssets: false,
      compression: false,
    }
  });

  const watchedExportType = watch('exportType');
  const watchedFormat = watch('format');

  useEffect(() => {
    loadExportOptions();
    validateProject();
  }, []);

  useEffect(() => {
    if (watchedExportType && watchedFormat) {
      generatePreview();
    }
  }, [watchedExportType, watchedFormat]);

  const loadExportOptions = async () => {
    try {
      const [formatsRes, typesRes, templatesRes] = await Promise.all([
        axios.get('/api/v1/exporter/formats'),
        axios.get('/api/v1/exporter/formats'),
        axios.get('/api/v1/exporter/templates')
      ]);

      setFormats(formatsRes.data.formats);
      setTypes(typesRes.data.types);
      setTemplates(templatesRes.data.templates);
    } catch (error) {
      console.error('Failed to load export options:', error);
    }
  };

  const validateProject = async () => {
    try {
      const response = await axios.post('/api/v1/exporter/validate', {
        project_id: projectId
      });
      setValidation(response.data);
    } catch (error) {
      console.error('Failed to validate project:', error);
      setValidation({
        ready: false,
        checks: {},
        warnings: ['Failed to validate project'],
        errors: ['Validation failed']
      });
    }
  };

  const generatePreview = async () => {
    try {
      // Generate a preview based on the selected export type and format
      const previewData = {
        exportType: watchedExportType,
        format: watchedFormat,
        timestamp: new Date().toISOString(),
        sampleData: getSampleData(watchedExportType)
      };
      setPreviewData(previewData);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    }
  };

  const getSampleData = (exportType: string) => {
    switch (exportType) {
      case 'story_graph':
        return {
          nodes: [
            { id: 'start', type: 'scene', title: 'Opening Scene' },
            { id: 'conflict', type: 'scene', title: 'Rising Action' },
            { id: 'climax', type: 'scene', title: 'Climax' }
          ],
          edges: [
            { from: 'start', to: 'conflict' },
            { from: 'conflict', to: 'climax' }
          ]
        };
      case 'dialogue_tree':
        return {
          root_node: { id: 'greeting', text: 'Hello there!' },
          characters: ['Player', 'NPC'],
          branching_paths: [
            { from: 'greeting', to: 'response1', condition: 'friendly' },
            { from: 'greeting', to: 'response2', condition: 'hostile' }
          ]
        };
      case 'quest_schema':
        return {
          quests: [
            { id: 'main_quest', title: 'Main Quest', difficulty: 'medium' },
            { id: 'side_quest', title: 'Side Quest', difficulty: 'easy' }
          ],
          objectives: ['Find the artifact', 'Defeat the boss'],
          rewards: ['Experience', 'Gold', 'Items']
        };
      default:
        return { message: 'Sample data for export' };
    }
  };

  const onSubmit = async (data: ExportFormData) => {
    setIsLoading(true);
    try {
      const response = await axios.post('/api/v1/exporter/export', {
        project_id: projectId,
        export_type: data.exportType,
        format: data.format,
        include_metadata: data.includeMetadata,
        include_assets: data.includeAssets,
        compression: data.compression,
        custom_template: data.customTemplate,
      });

      setExportResult(response.data);
      setActiveTab('download');
    } catch (error: any) {
      console.error('Export failed:', error);
      setExportResult({
        success: false,
        export_id: '',
        file_path: '',
        file_size: 0,
        metadata: null,
        warnings: [],
        errors: [error.response?.data?.detail || 'Export failed']
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!exportResult?.download_url) return;
    
    try {
      const response = await axios.get(exportResult.download_url, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `export_${projectId}_${Date.now()}.${watchedFormat}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const renderValidationWarnings = () => {
    if (!validation) return null;

    const hasWarnings = validation.warnings.length > 0;
    const hasErrors = validation.errors.length > 0;
    const notReady = !validation.ready;

    if (!hasWarnings && !hasErrors && validation.ready) {
      return (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-green-800 font-medium">Project ready for export</span>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <div className="flex items-center mb-2">
          <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-yellow-800 font-medium">Export Warnings</span>
        </div>
        
        {notReady && (
          <p className="text-yellow-700 mb-2">Some project components are not ready for export.</p>
        )}
        
        {hasWarnings && (
          <ul className="list-disc list-inside text-yellow-700 mb-2">
            {validation.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        )}
        
        {hasErrors && (
          <div className="mt-2">
            <p className="text-red-700 font-medium">Errors:</p>
            <ul className="list-disc list-inside text-red-700">
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderConfigurationTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Export Configuration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Export Type
            </label>
            <Controller
              name="exportType"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {types.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.description}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.exportType && (
              <p className="mt-1 text-sm text-red-600">{errors.exportType.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format
            </label>
            <Controller
              name="format"
              control={control}
              render={({ field }) => (
                <select
                  {...field}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {formats.map((format) => (
                    <option key={format.value} value={format.value}>
                      {format.description}
                    </option>
                  ))}
                </select>
              )}
            />
            {errors.format && (
              <p className="mt-1 text-sm text-red-600">{errors.format.message}</p>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex items-center">
            <Controller
              name="includeMetadata"
              control={control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  {...field}
                  checked={field.value}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              )}
            />
            <label className="ml-2 block text-sm text-gray-900">
              Include metadata
            </label>
          </div>

          <div className="flex items-center">
            <Controller
              name="includeAssets"
              control={control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  {...field}
                  checked={field.value}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              )}
            />
            <label className="ml-2 block text-sm text-gray-900">
              Include assets (images, audio, etc.)
            </label>
          </div>

          <div className="flex items-center">
            <Controller
              name="compression"
              control={control}
              render={({ field }) => (
                <input
                  type="checkbox"
                  {...field}
                  checked={field.value}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
              )}
            />
            <label className="ml-2 block text-sm text-gray-900">
              Enable compression
            </label>
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Custom Template (optional)
          </label>
          <Controller
            name="customTemplate"
            control={control}
            render={({ field }) => (
              <textarea
                {...field}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter custom template if needed..."
              />
            )}
          />
        </div>
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('preview')}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Preview
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          {isLoading ? 'Exporting...' : 'Export'}
        </button>
      </div>
    </div>
  );

  const renderPreviewTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Export Preview</h3>
        
        {previewData && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Export Details</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Type:</span>
                  <span className="ml-2 text-gray-900">{previewData.exportType}</span>
                </div>
                <div>
                  <span className="text-gray-500">Format:</span>
                  <span className="ml-2 text-gray-900">{previewData.format}</span>
                </div>
                <div>
                  <span className="text-gray-500">Timestamp:</span>
                  <span className="ml-2 text-gray-900">
                    {new Date(previewData.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Sample Data</h4>
              <pre className="bg-white border border-gray-200 rounded p-3 text-xs overflow-auto max-h-64">
                {JSON.stringify(previewData.sampleData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => setActiveTab('configure')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Back
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
        >
          {isLoading ? 'Exporting...' : 'Export'}
        </button>
      </div>
    </div>
  );

  const renderDownloadTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Export Complete</h3>
        
        {exportResult && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            {exportResult.success ? (
              <div>
                <div className="flex items-center mb-4">
                  <svg className="w-6 h-6 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-green-800 font-medium">Export successful!</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">Export ID:</span>
                    <span className="ml-2 text-gray-900">{exportResult.export_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">File Size:</span>
                    <span className="ml-2 text-gray-900">
                      {(exportResult.file_size / 1024).toFixed(2)} KB
                    </span>
                  </div>
                </div>
                
                {exportResult.warnings.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-yellow-700 mb-2">Warnings</h4>
                    <ul className="list-disc list-inside text-sm text-yellow-700">
                      {exportResult.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <button
                  onClick={handleDownload}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Download Export
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center mb-4">
                  <svg className="w-6 h-6 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-red-800 font-medium">Export failed</span>
                </div>
                
                {exportResult.errors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-red-700 mb-2">Errors</h4>
                    <ul className="list-disc list-inside text-sm text-red-700">
                      {exportResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => setActiveTab('configure')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          New Export
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Close
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Export Wizard</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {renderValidationWarnings()}

          <div className="mb-6">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('configure')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'configure'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Configure
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'preview'
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Preview
              </button>
              {exportResult && (
                <button
                  onClick={() => setActiveTab('download')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'download'
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Download
                </button>
              )}
            </nav>
          </div>

          <form onSubmit={handleSubmit(onSubmit)}>
            {activeTab === 'configure' && renderConfigurationTab()}
            {activeTab === 'preview' && renderPreviewTab()}
            {activeTab === 'download' && renderDownloadTab()}
          </form>
        </div>
      </div>
    </div>
  );
}
