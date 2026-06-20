// src/components/shared/ProgressCell.tsx
import React from 'react';
import { Progress } from 'antd';
import { tokens } from '@/constants/tokens';
import type { ProgressBand } from '@/types';

interface ProgressCellProps {
  percent: number;
  band: ProgressBand;
}

export const ProgressCell: React.FC<ProgressCellProps> = ({ percent, band }) => {
  const bandColor = tokens.band[band];
  
  return (
    <Progress
      percent={percent}
      strokeColor={bandColor}
      size="small"
      format={(p) => `${p}%`}
    />
  );
};