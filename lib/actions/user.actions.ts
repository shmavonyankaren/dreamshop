"use server";

import handleError from "../utils/handleError";
import sendEmail from "../utils/sendEmail";

export async function sendContactForm(form: FormData) {
  try {
    const name = form.get("name");
    const email = form.get("email");
    const subject = form.get("subject");
    const message = form.get("message");

    sendEmail(
      name as string,
      email as string,
      subject as string,
      message as string,
    );
  } catch (error) {
    handleError(error);
  }
}
