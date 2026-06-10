import { Injectable } from '@nestjs/common';
import { AppointmentNote } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateAppointmentNoteDto } from './dto';
import { UpdateAppointmentNoteDto } from './dto';

const INCLUDE_DOCTOR = {
  doctor: {
    select: {
      id: true,
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  },
} as const;

@Injectable()
export class AppointmentNoteRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    appointmentId: string,
    doctorId: string,
    dto: CreateAppointmentNoteDto,
  ): Promise<AppointmentNote> {
    return this.prisma.appointmentNote.create({
      data: {
        appointmentId,
        doctorId,
        diagnosis: dto.diagnosis,
        treatment: dto.treatment,
        medications: dto.medications ?? [],
        followUpRequired: dto.followUpRequired ?? false,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        notes: dto.notes,
      },
      include: INCLUDE_DOCTOR,
    });
  }

  async findByAppointment(appointmentId: string): Promise<AppointmentNote | null> {
    return this.prisma.appointmentNote.findUnique({
      where: { appointmentId },
      include: INCLUDE_DOCTOR,
    });
  }

  async findById(id: string): Promise<AppointmentNote | null> {
    return this.prisma.appointmentNote.findUnique({
      where: { id },
      include: INCLUDE_DOCTOR,
    });
  }

  async update(id: string, dto: UpdateAppointmentNoteDto): Promise<AppointmentNote> {
    return this.prisma.appointmentNote.update({
      where: { id },
      data: {
        ...(dto.diagnosis !== undefined && { diagnosis: dto.diagnosis }),
        ...(dto.treatment !== undefined && { treatment: dto.treatment }),
        ...(dto.medications !== undefined && { medications: dto.medications }),
        ...(dto.followUpRequired !== undefined && { followUpRequired: dto.followUpRequired }),
        ...(dto.followUpDate !== undefined && {
          followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: INCLUDE_DOCTOR,
    });
  }

  async existsByAppointment(appointmentId: string): Promise<boolean> {
    return (await this.prisma.appointmentNote.count({ where: { appointmentId } })) > 0;
  }
}
