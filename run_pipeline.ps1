# run_pipeline.ps1
# Master End-to-End Pipeline Runner for SIH-2026 Machhu-II Simulation

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  Machhu-II Dam Breach 3D Flood Inundation Simulation Pipeline   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Activate virtual environment if not already activated
if (-not $env:VIRTUAL_ENV) {
    if (Test-Path ".\.venv\Scripts\Activate.ps1") {
        Write-Host "`n[+] Activating virtual environment (.venv)..." -ForegroundColor Yellow
        .\.venv\Scripts\Activate.ps1
    }
}

$scripts = @(
    @{ Name = "01_download_data.py"; Desc = "Directive 1: Automated Data Ingestion" },
    @{ Name = "02_extract_dam_data.py"; Desc = "Directive 1: NRLD Dam Record Extraction" },
    @{ Name = "03_download_lulc.py"; Desc = "Directive 1: ESA WorldCover 10m LULC Ingestion" },
    @{ Name = "05_clip_rivers.py"; Desc = "Directive 1: HydroRIVERS AOI Clipping" },
    @{ Name = "06_dem_catchment.py"; Desc = "Directive 2: DEM Conditioning & Catchment Delineation" },
    @{ Name = "07_dem_catchment_maps.py"; Desc = "Directive 2: Catchment & DEM Map Production" },
    @{ Name = "08_curve_number_hydrology.py"; Desc = "Directive 3: SCS-CN Hydrology & Inflow Hydrograph" },
    @{ Name = "09_breach_parameters.py"; Desc = "Directive 4: Froehlich Dam Breach Parameter Estimation" },
    @{ Name = "10_hydrodynamic_simulation.py"; Desc = "Directive 5A: 2D Hydrodynamic Flood Simulation Engine" },
    @{ Name = "11_gee_flood_analysis.py"; Desc = "Directive 5B: GEE / Satellite Flood Extent Analysis" },
    @{ Name = "12_validation_and_sensitivity.py"; Desc = "Directive 6: Accuracy Assessment & Sensitivity Analysis" },
    @{ Name = "13_damage_analysis.py"; Desc = "Directive 7: Population, Infrastructure & Economic Damage Assessment" },
    @{ Name = "14_risk_analysis.py"; Desc = "Directive 8: Composite Risk Zoning & Evacuation Plan" }
)

foreach ($item in $scripts) {
    $scriptPath = "scripts\$($item.Name)"
    if (Test-Path $scriptPath) {
        Write-Host "`n>>> Running: $($item.Name) [$($item.Desc)]" -ForegroundColor Green
        python $scriptPath
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[!] Error encountered in $scriptPath (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
        }
    } else {
        Write-Host "[!] Script not found: $scriptPath" -ForegroundColor DarkYellow
    }
}

Write-Host "`n=================================================================" -ForegroundColor Cyan
Write-Host "  Pipeline Run Complete! All outputs generated in /outputs & /data" -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
