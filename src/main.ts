import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ 
    transform: true,
    whitelist: true 
  }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
}
bootstrap();