const verifyEmailTemplate = (variables) => {
  const subject = 'Por favor, verifique seu endereço de e-mail';

  const variableNames = ['username', 'verificationUrl'];

  const missingVariables = variableNames.filter((name) => !variables[name]);
  if (missingVariables.length > 0) {
    throw new Error(`Missing variables: ${missingVariables.join(', ')}`);
  }

  const templateString = `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                          <h2>Verificação de E-mail</h2>
                          <p>Olá {{username}},</p>
                          <p>Obrigado por se registrar conosco. Por favor, clique no link abaixo para verificar seu endereço de e-mail:</p>
                          <div style="text-align: center; margin: 30px 0;">
                            <a href="{{verificationUrl}}" 
                              style="background-color: #007bff; color: white; padding: 12px 24px; 
                                      text-decoration: none; border-radius: 4px; display: inline-block;">
                              Verificar E-mail
                            </a>
                          </div>
                          <p>Ou copie e cole este link no seu navegador:</p>
                          <p style="word-break: break-all; color: #666;">{{verificationUrl}}</p>
                          <p>Este link de verificação expirará em 1 hora.</p>
                          <p>Se você não se registrou nesta conta, por favor, ignore este e-mail.</p>
                        </div>
                        `;

  const html = renderTemplate(templateString, variables);

  return {
    subject,
    html,
  };
};

const forgotPasswordTemplate = (variables) => {
  const subject = 'Código de Segurança para Redefinição de Senha';

  const variableNames = ['securityCode'];

  const missingVariables = variableNames.filter((name) => !variables[name]);
  if (missingVariables.length > 0) {
    throw new Error(`Missing variables: ${missingVariables.join(', ')}`);
  }

  const templateString = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Solicitação de Redefinição de Senha</h2>
          <p>Você solicitou uma redefinição de senha para sua conta.</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px;">
              <p style="margin: 0; font-size: 14px; color: #666;">Seu Código de Segurança é:</p>
              <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 2px;">
                {{securityCode}}
              </p>
            </div>
          </div>
          <p>Este código expirará em 10 minutos.</p>
          <p>Se você não solicitou uma redefinição de senha, por favor, ignore este e-mail.</p>
        </div>
  `;

  const html = renderTemplate(templateString, variables);

  return {
    subject,
    html,
  };
};

const renderTemplate = (template, variables) => {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
};

const getEmailTemplate = (templateName, variables) => {
  switch (templateName) {
    case 'verifyEmail':
      return verifyEmailTemplate(variables);
    case 'forgotPassword':
      return forgotPasswordTemplate(variables);
    default:
      throw new Error(`Template ${templateName} not found`);
  }
};

export { getEmailTemplate };
