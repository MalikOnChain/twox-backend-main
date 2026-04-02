interface IRegIp extends Mongoose.Document {
  ip_address: string;

  // When this ip was used to register
  used: Date;
}
