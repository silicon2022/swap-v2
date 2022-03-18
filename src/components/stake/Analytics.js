import React from 'react';
import { FlexContainer } from '../shared/FlexContainer';
import InfoPopup from '../shared/InfoPopup';
import Label from '../shared/Label';

const Analytics = ({ apr, volume, stakedShare, totalStaked }) => {
  return (
    <div className="column w-100 h-100">
      <Label fontSize={16} fontFamily="syncopate">
        analytics
      </Label>

      <FlexContainer withGradient className="column justify-sb background-fill">
        <div>
          <div className="flex align-ce">
            <Label>APR</Label>
            <InfoPopup>
              Standing for Annual Percentage Rate, it shows the estimated yearly interest generated by your stake. It does not take compounding into
              account.
            </InfoPopup>
          </div>
          <Label fontSize={32} fontFamily="syncopate">
            {apr}%
          </Label>
        </div>
        <div>
          <Label>Volume</Label>
          <Label fontSize={32}>{volume} USD</Label>
        </div>
        <div>
          <div className="flex align-ce">
            <Label>Staked Share</Label>
            <InfoPopup>Your personal percentage share of KDX amongst all the KDX currently being staked.</InfoPopup>
          </div>
          <Label fontSize={32}>{stakedShare} %</Label>
        </div>
        <div>
          <Label>Total Staked</Label>
          <Label fontSize={32}>{totalStaked} %</Label>
        </div>
      </FlexContainer>
    </div>
  );
};

export default Analytics;
