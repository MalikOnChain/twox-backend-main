import Emails from '@/models/template/emails';

class BannerController {
  async getEmailTemplates() {
    const emails = await Emails.find().lean();
    return emails;
  }

  async getEmailTemplate(templateName) {
    const email = await Emails.findOne({ name: templateName }).lean();
    return email;
  }
}

export default new BannerController();
