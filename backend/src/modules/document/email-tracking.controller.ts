import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('emails/track')
export class EmailTrackingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('open/:logId')
  async trackOpen(@Param('logId') logId: string, @Res() res: Response) {
    try {
      const log = await this.prisma.invoiceEmailLog.findUnique({
        where: { id: logId }
      });

      if (log && (log.status === 'SENT' || log.status === 'DELIVERED')) {
        await this.prisma.invoiceEmailLog.update({
          where: { id: logId },
          data: {
            status: 'OPENED',
            openedAt: new Date()
          }
        });
      }
    } catch (err) {
      console.error('Error tracking open:', err);
    }

    // Return 1x1 transparent GIF pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    });
    res.end(pixel);
  }

  @Get('click/:logId')
  async trackClick(
    @Param('logId') logId: string,
    @Query('dest') dest: string,
    @Res() res: Response
  ) {
    try {
      const log = await this.prisma.invoiceEmailLog.findUnique({
        where: { id: logId }
      });

      if (log) {
        await this.prisma.invoiceEmailLog.update({
          where: { id: logId },
          data: {
            status: 'CLICKED',
            clickedAt: new Date()
          }
        });
      }
    } catch (err) {
      console.error('Error tracking click:', err);
    }

    // Redirect to destination URL (or fallback to app dashboard)
    const redirectUrl = dest || 'http://localhost:5173/';
    res.redirect(redirectUrl);
  }
}
