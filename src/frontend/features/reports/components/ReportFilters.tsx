import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '../../../store';
import { setFilters, ReportFilters as Filters } from '../store/reportSlice';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

const ReportFilters: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { filters } = useSelector((s: RootState) => s.reports);

  return (
    <div data-testid="report-filters" aria-label="Report filters">
      <div>
        <label htmlFor="report-month">Month</label>
        <select
          id="report-month"
          data-testid="report-month-select"
          value={filters.month}
          onChange={e => dispatch(setFilters({ month: parseInt(e.target.value, 10) }))}
          aria-label="Select month"
        >
          {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="report-year">Year</label>
        <select
          id="report-year"
          data-testid="report-year-select"
          value={filters.year}
          onChange={e => dispatch(setFilters({ year: parseInt(e.target.value, 10) }))}
          aria-label="Select year"
        >
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="report-format">Format</label>
        <select
          id="report-format"
          data-testid="report-format-select"
          value={filters.format}
          onChange={e => dispatch(setFilters({ format: e.target.value as Filters['format'] }))}
          aria-label="Select format"
        >
          <option value="pdf">PDF</option>
          <option value="excel">Excel</option>
          <option value="csv">CSV</option>
        </select>
      </div>
    </div>
  );
};

export default ReportFilters;
