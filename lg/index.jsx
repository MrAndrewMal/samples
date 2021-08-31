/* eslint-disable react/jsx-one-expression-per-line */
import React, { memo, useState, useContext, useCallback } from 'react';
import styled from 'styled-components';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import { ViewerContext } from '@fjedi/react-router-helpers';
// GraphQL
import { logger, useQuery } from '@fjedi/graphql-react-components';
// GraphQL Queries
import getRides from 'src/graphql/queries/get-rides.graphql';
//
import { RowItem as CustomRowItem } from 'src/components/ui-kit/grid';
import LabelInfo from 'src/components/ui-kit/label/info';
import Spinner from 'src/components/ui-kit/spinner';
import Button from 'src/components/ui-kit/buttons';
import ModalPopup from 'src/components/ui-kit/modal-popup';
import FiltersComponent from 'src/components/common/filters';
import RidesRow from './rides-row';
import { BodyUnloadingColorIcon, FilterIcon } from './assets/index';
//
const FirstRow = styled.div`
  display: flex;
  gap: 1.3125em;
  justify-content: flex-end;
`;
const LabelFilter = styled(LabelInfo)`
  background: none;
  display: flex;
  align-items: flex-end;
`;
const Container = styled.div`
  display: flex;
  padding: 0.75em;
  height: 100%;
`;
const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  justify-content: space-around;
`;
const Row = styled.div`
  display: flex;
  font-size: 0.875rem;
  > div {
    flex-grow: 1;
    flex-basis: 100%;
  }
  span {
    font-size: 0.5625rem;
  }
`;
const RowItem = styled(CustomRowItem)`
  margin: 0 !important;
  .wrapper {
    margin: 0;
  }
`;
const Icon = styled.img`
  background-color: #f0f3f8;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
`;
const StyledModalPopup = styled(ModalPopup)`
  .modal-popup__body {
    padding: 0 2em;
  }
`;

const VISIBLE_FILTERS = ['drivers'];

const DashboardPage = memo(() => {
  const { t } = useTranslation();
  //
  const onFiltersChange = useCallback(filters => {
    //
    logger('DashboardPage.onFiltersChange', { filters });
  }, []);
  const variables = { filter: {}, pagination: { limit: 10, offset: 10 } };
  const viewer = useContext(ViewerContext);
  const [fromValue, setFromValue] = useState(null);
  const [toValue, setToValue] = useState(null);
  const [visibleFilter, setVisibleFilter] = useState(null);
  const queryResult = useQuery(getRides, {
    variables,
    notifyOnNetworkStatusChange: true, // This is required to set "loading: true" after fetchMore is called
    skip: !viewer,
  });
  const onCancel = useCallback(() => setVisibleFilter(false), []);
  const onClick = useCallback(() => setVisibleFilter(true), []);
  if (!viewer) {
    return null;
  }
  const { data: { getRides: rides } = {}, subscribeToMore, loading, fetchMore } = queryResult;
  logger({ rides, viewer });
  return (
    <Spinner spinning={loading}>
      {!loading && (
        <>
          <StyledModalPopup isVisible={visibleFilter} onCancel={onCancel}>
            <FiltersComponent visibleFilters={VISIBLE_FILTERS} onChange={onFiltersChange} />
          </StyledModalPopup>
          <FirstRow>
            <LabelFilter>
              <Button type="text" onClick={onClick}>
                <img alt="Фильтр" src={FilterIcon} />
              </Button>
            </LabelFilter>
            <LabelInfo>
              <Container>
                <Wrapper>
                  <Row>
                    <div>
                      <strong>{rides?.count}</strong> <span>рейсов</span>
                    </div>
                    <div style={{ fontWeight: '700' }}>{Math.round(rides?.totalMass)} тн</div>
                    <div style={{ fontWeight: '700' }}>{Math.round(rides?.totalVol)} м3</div>
                  </Row>
                  <Row>
                    <RowItem title={`${rides?.salary} р`} subTitle="прибыль" />
                    <RowItem title="50 000 р" subTitle="груз" />
                    <RowItem title="187 000 р" subTitle="груз" />
                  </Row>
                </Wrapper>
                <Icon src={BodyUnloadingColorIcon} />
              </Container>
            </LabelInfo>
            <LabelInfo> </LabelInfo>
            <LabelInfo> </LabelInfo>
          </FirstRow>
        </>
      )}
      {(rides?.rows ?? []).map(item => (
        <RidesRow key={item.id} data={item} />
      ))}
    </Spinner>
  );
});
DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;
