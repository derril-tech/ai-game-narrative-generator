"""
Exporter API endpoints for generating exports and design documents.
"""

from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends
from pydantic import BaseModel

from app.agents.exporter import (
    ExporterAgent, 
    ExportRequest, 
    ExportResponse, 
    ExportFormat, 
    ExportType
)
from app.core.logging import get_logger
from app.utils.metrics import record_metric
from app.utils.auth import get_current_user

logger = get_logger(__name__)
router = APIRouter()


class ExportRequestModel(BaseModel):
    """Request model for export generation."""
    project_id: str
    export_type: ExportType
    format: ExportFormat
    include_metadata: bool = True
    include_assets: bool = False
    compression: bool = False
    custom_template: str = None
    output_path: str = None


class BatchExportRequest(BaseModel):
    """Request model for batch export generation."""
    requests: List[ExportRequestModel]


class ExportValidationRequest(BaseModel):
    """Request model for export validation."""
    project_id: str


class ExportValidationResponse(BaseModel):
    """Response model for export validation."""
    ready: bool
    checks: Dict[str, bool]
    warnings: List[str] = []
    errors: List[str] = []


@router.post("/export", response_model=ExportResponse)
async def generate_export(
    request: ExportRequestModel,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Generate a single export."""
    try:
        record_metric("exporter.api.export_requested", {
            "user_id": current_user.get("id"),
            "project_id": request.project_id,
            "export_type": request.export_type,
            "format": request.format
        })
        
        exporter = ExporterAgent()
        
        # Convert to internal request model
        export_request = ExportRequest(
            project_id=request.project_id,
            export_type=request.export_type,
            format=request.format,
            include_metadata=request.include_metadata,
            include_assets=request.include_assets,
            compression=request.compression,
            custom_template=request.custom_template,
            output_path=request.output_path
        )
        
        # Generate export
        response = await exporter.export_content(export_request)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.errors[0] if response.errors else "Export failed")
        
        record_metric("exporter.api.export_completed", {
            "user_id": current_user.get("id"),
            "project_id": request.project_id,
            "export_type": request.export_type,
            "format": request.format,
            "file_size": response.file_size
        })
        
        return response
        
    except Exception as e:
        logger.error(f"Export generation failed: {str(e)}")
        record_metric("exporter.api.export_failed", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/batch", response_model=List[ExportResponse])
async def generate_batch_exports(
    request: BatchExportRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    """Generate multiple exports in batch."""
    try:
        record_metric("exporter.api.batch_export_requested", {
            "user_id": current_user.get("id"),
            "count": len(request.requests)
        })
        
        exporter = ExporterAgent()
        
        # Convert to internal request models
        export_requests = [
            ExportRequest(
                project_id=req.project_id,
                export_type=req.export_type,
                format=req.format,
                include_metadata=req.include_metadata,
                include_assets=req.include_assets,
                compression=req.compression,
                custom_template=req.custom_template,
                output_path=req.output_path
            )
            for req in request.requests
        ]
        
        # Generate exports
        responses = await exporter.generate_batch_exports(export_requests)
        
        # Filter out exceptions and convert to proper responses
        valid_responses = []
        for response in responses:
            if isinstance(response, Exception):
                logger.error(f"Batch export item failed: {str(response)}")
                valid_responses.append(ExportResponse(
                    success=False,
                    export_id="",
                    file_path="",
                    file_size=0,
                    metadata=None,
                    warnings=[],
                    errors=[str(response)]
                ))
            else:
                valid_responses.append(response)
        
        record_metric("exporter.api.batch_export_completed", {
            "user_id": current_user.get("id"),
            "total": len(request.requests),
            "successful": len([r for r in valid_responses if r.success])
        })
        
        return valid_responses
        
    except Exception as e:
        logger.error(f"Batch export generation failed: {str(e)}")
        record_metric("exporter.api.batch_export_failed", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/validate", response_model=ExportValidationResponse)
async def validate_export_ready(
    request: ExportValidationRequest,
    current_user: dict = Depends(get_current_user)
):
    """Validate that a project is ready for export."""
    try:
        record_metric("exporter.api.validation_requested", {
            "user_id": current_user.get("id"),
            "project_id": request.project_id
        })
        
        exporter = ExporterAgent()
        
        # Validate export readiness
        validation_result = await exporter.validate_export_ready(request.project_id)
        
        if "error" in validation_result:
            return ExportValidationResponse(
                ready=False,
                checks=validation_result.get("checks", {}),
                errors=[validation_result["error"]]
            )
        
        warnings = []
        if not validation_result.get("ready", False):
            warnings.append("Some project components are not ready for export")
        
        record_metric("exporter.api.validation_completed", {
            "user_id": current_user.get("id"),
            "project_id": request.project_id,
            "ready": validation_result.get("ready", False)
        })
        
        return ExportValidationResponse(
            ready=validation_result.get("ready", False),
            checks=validation_result.get("checks", {}),
            warnings=warnings
        )
        
    except Exception as e:
        logger.error(f"Export validation failed: {str(e)}")
        record_metric("exporter.api.validation_failed", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/export/formats")
async def get_supported_formats():
    """Get list of supported export formats."""
    return {
        "formats": [
            {"value": format.value, "name": format.name, "description": f"Export as {format.value.upper()}"}
            for format in ExportFormat
        ],
        "types": [
            {"value": type.value, "name": type.name, "description": f"Export {type.value.replace('_', ' ')}"}
            for type in ExportType
        ]
    }


@router.get("/export/templates")
async def get_available_templates():
    """Get list of available export templates."""
    try:
        exporter = ExporterAgent()
        return {
            "templates": list(exporter.export_templates.keys()),
            "custom_templates_supported": True
        }
    except Exception as e:
        logger.error(f"Failed to get templates: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/design-doc")
async def generate_design_document(
    request: ExportRequestModel,
    current_user: dict = Depends(get_current_user)
):
    """Generate a comprehensive design document."""
    try:
        record_metric("exporter.api.design_doc_requested", {
            "user_id": current_user.get("id"),
            "project_id": request.project_id,
            "format": request.format
        })
        
        # Override export type for design document
        design_doc_request = ExportRequestModel(
            **request.dict(),
            export_type=ExportType.DESIGN_DOC
        )
        
        exporter = ExporterAgent()
        
        # Convert to internal request model
        export_request = ExportRequest(
            project_id=design_doc_request.project_id,
            export_type=design_doc_request.export_type,
            format=design_doc_request.format,
            include_metadata=design_doc_request.include_metadata,
            include_assets=design_doc_request.include_assets,
            compression=design_doc_request.compression,
            custom_template=design_doc_request.custom_template,
            output_path=design_doc_request.output_path
        )
        
        # Generate design document
        response = await exporter.export_content(export_request)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.errors[0] if response.errors else "Design document generation failed")
        
        record_metric("exporter.api.design_doc_completed", {
            "user_id": current_user.get("id"),
            "project_id": request.project_id,
            "format": request.format,
            "file_size": response.file_size
        })
        
        return response
        
    except Exception as e:
        logger.error(f"Design document generation failed: {str(e)}")
        record_metric("exporter.api.design_doc_failed", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/export/full-project")
async def generate_full_project_export(
    request: ExportRequestModel,
    current_user: dict = Depends(get_current_user)
):
    """Generate a complete project export with all components."""
    try:
        record_metric("exporter.api.full_project_requested", {
            "user_id": current_user.get("id"),
            "project_id": request.project_id,
            "format": request.format
        })
        
        # Override export type for full project
        full_project_request = ExportRequestModel(
            **request.dict(),
            export_type=ExportType.FULL_PROJECT
        )
        
        exporter = ExporterAgent()
        
        # Convert to internal request model
        export_request = ExportRequest(
            project_id=full_project_request.project_id,
            export_type=full_project_request.export_type,
            format=full_project_request.format,
            include_metadata=full_project_request.include_metadata,
            include_assets=full_project_request.include_assets,
            compression=full_project_request.compression,
            custom_template=full_project_request.custom_template,
            output_path=full_project_request.output_path
        )
        
        # Generate full project export
        response = await exporter.export_content(export_request)
        
        if not response.success:
            raise HTTPException(status_code=400, detail=response.errors[0] if response.errors else "Full project export failed")
        
        record_metric("exporter.api.full_project_completed", {
            "user_id": current_user.get("id"),
            "project_id": request.project_id,
            "format": request.format,
            "file_size": response.file_size
        })
        
        return response
        
    except Exception as e:
        logger.error(f"Full project export failed: {str(e)}")
        record_metric("exporter.api.full_project_failed", {"error": str(e)})
        raise HTTPException(status_code=500, detail=str(e))

