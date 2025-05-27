import React from 'react';
import { getStatusConfig, statusBadgeClasses, type StatusBadgeProps } from '../utils/statusUtils';

// Reusable status badge component to eliminate duplication
const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  processingStatus, 
  className = '' 
}) => {
  const config = getStatusConfig(status, processingStatus);
  
  return (
    <span className={`${statusBadgeClasses} ${config.className} ${className}`}>
      {config.text}
    </span>
  );
};

export default StatusBadge; 