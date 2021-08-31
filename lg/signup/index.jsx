import React, { memo, useMemo, useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import styled from 'styled-components';
import logger from 'src/helpers/logger';
import PhoneNumber from 'awesome-phonenumber';
// Redux
import { isEmail, isPhoneNumber } from 'src/helpers/validators';
// GraphQL
import { useMutation } from '@fjedi/graphql-react-components';
// GraphQL Mutations
import signupMutation from 'src/graphql/mutations/sign-up.graphql';
// GraphQL Queries
import userQuery from 'src/graphql/queries/user.graphql';
//
import { MailFilled, PhoneFilled } from '@ant-design/icons';
import { Form, FormItem } from 'src/components/ui-kit/form';
import { Input, PasswordInput } from 'src/components/ui-kit/input';
import { Select, Option } from 'src/components/ui-kit/select';
import Link from 'src/components/ui-kit/buttons/link';
import Button from 'src/components/ui-kit/buttons';

//
const StyledForm = styled(Form)``;
const SubTitle = styled.div`
  font-size: 0.875rem;
  line-height: 17px;
  color: #1c2445;
  font-weight: 700;
  margin-bottom: 1.625em;
`;
const Help = styled.div`
  text-align: center;
  margin-top: 1rem;
`;
const Agreement = styled.div`
  font-size: 0.5625rem;
  margin-bottom: 1.5rem;
`;
const WrapFormItem = styled.div`
  display: flex;
  gap: 1em;
  justify-content: center;
`;
const StyledButton = styled(Button)`
  &.ant-btn.ant-btn-primary.ant-btn-block {
    height: 38px;
    margin-top: 0;
  }
`;
const StyledSelect = styled(Select)`
  &.ant-select-single:not(.ant-select-customize-input) .ant-select-selector {
    height: 38px;
    border: none;
    background-color: #f0f3f8;
  }
`;
const Signup = memo(props => {
  const { onSignup } = props;
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [validateEmail, setValidateEmail] = useState(false);
  const [validatePhone, setValidatePhone] = useState(false);
  const checkConfirm = useCallback(
    (rule, value) => {
      if (value && value !== form.getFieldValue('password')) {
        return Promise.reject(t('Entered passwords must match'));
      }
      return Promise.resolve();
    },
    [form, t],
  );

  const onCompleted = useCallback(data => {
    logger('===AUTH_SUCCESS: ', data);
    form.resetFields();
    window.location.reload();
  });

  const update = useCallback(
    (cache, { data: { signUp } }) => {
      cache.writeQuery({
        query: userQuery,
        data: { user: signUp },
      });
      onSignup(signUp);
    },
    [onSignup],
  );

  const [signup, { loading }] = useMutation(signupMutation, { onCompleted, update });

  const onSubmit = useCallback(
    input => {
      const { phoneNumber: phone, email, password, lastName, firstName, role, companyName } = input;
      const pn = new PhoneNumber(phone);
      const phoneNumber = pn.isValid() ? parseInt(pn.getNumber('significant'), 10) : null;
      const phoneCountryCode = pn.isValid() ? PhoneNumber.getCountryCodeForRegionCode(pn.getRegionCode()) : null;
      signup({
        variables: {
          input: {
            lastName,
            firstName,
            role,
            email,
            password,
            companyName,
            phoneNumber: `${phoneNumber}`,
            phoneCountryCode,
          },
        },
      });
    },
    [signup],
  );

  return (
    <StyledForm onFinish={onSubmit} layout="vertical" form={form}>
      <SubTitle>
        Добро пожаловать в Логистат! <br />
        Вы можете протестировать работу программы 14 дней бесплатно.
        <br />
        Для регистрации аккаунта, пожалуйста, заполните информацию о себе
      </SubTitle>
      <WrapFormItem>
        <FormItem name="lastName">
          <Input type="text" placeholder={t('Last name')} />
        </FormItem>
        <FormItem name="firstName">
          <Input type="text" placeholder={t('First name')} />
        </FormItem>
      </WrapFormItem>
      <Agreement>
        Нажимая кнопку “Зарегистрироваться”, вы принимаете <Link to="#">пользовательское соглашение</Link>, даете,
        согласие на обработку персональных данных, а так же подтверждаете, что ознакомились с{' '}
        <Link to="#">политикой конфиденциальности</Link>
      </Agreement>
      <WrapFormItem>
        <FormItem
          validateTrigger={['onChange', 'onBlur']}
          name="phoneNumber"
          rules={[{ validator: validatePhone && isPhoneNumber }]}>
          <Input
            type="tel"
            onBlur={() => setValidatePhone(true)}
            placeholder={t('Phone number')}
            suffix={<PhoneFilled style={{ color: '#52A6C0', fontSize: '14px' }} />}
          />
        </FormItem>
        <FormItem
          validateTrigger={['onChange', 'onBlur']}
          name="email"
          rules={[{ validator: validateEmail && isEmail }]}>
          <Input
            type="email"
            onBlur={() => setValidateEmail(true)}
            placeholder={t('Email')}
            autoComplete="email"
            suffix={<MailFilled style={{ color: '#52A6C0', fontSize: '14px' }} />}
          />
        </FormItem>
      </WrapFormItem>
      <WrapFormItem>
        <FormItem
          validateTrigger={['onBlur']}
          name="password"
          rules={[
            { required: true, message: t('Please fill this field') },
            {
              min: 8,
              message: t('Minimal length of the password - {{length}} symbols', {
                length: 8,
              }),
            },
            {
              max: 30,
              message: t('Maximal length of the password - {{length}} symbols', {
                length: 30,
              }),
            },
          ]}>
          <PasswordInput autoComplete="password" type="password" placeholder={t('Password')} />
        </FormItem>
        <FormItem
          validateTrigger={['onBlur']}
          name="passwordConfirmation"
          rules={[{ required: true, message: t('Confirm password entered') }, { validator: checkConfirm }]}>
          <PasswordInput type="password" placeholder={t('Confirm password entered')} />
        </FormItem>
      </WrapFormItem>
      <WrapFormItem>
        <FormItem name="role" rule={[{ required: true, message: t('Please fill this field') }]}>
          <StyledSelect>
            <Option value="driver">{t('Driver')}</Option>
          </StyledSelect>
        </FormItem>
        <FormItem>
          <StyledButton block loading={loading} type="primary" size="large" htmlType="submit">
            {t('Sign up')}
          </StyledButton>
        </FormItem>
      </WrapFormItem>
      <Help>
        <Link to="/login">{t('Already registered?')}</Link>
      </Help>
    </StyledForm>
  );
});

Signup.propTypes = {
  onSignup: PropTypes.func,
};

Signup.defaultProps = {
  onSignup: () => {
    // document.location = `${getServerURL()}/dashboard`;
  },
};
Signup.displayName = 'Signup';
export default Signup;
