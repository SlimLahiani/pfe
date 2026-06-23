import { Injectable, ConflictException, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { LeaveType } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });

    if (existingUser) {
      throw new ConflictException('A user with this email address already exists.');
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.findUnique({
        where: { id: createUserDto.roleId },
      });
      if (!role) {
        throw new BadRequestException('Role not found.');
      }

      const passwordHash = await bcrypt.hash(createUserDto.password, 10);
      const isGerant = role.name === 'GERANT';
      let employeeProfileData: any = null;

      if (!isGerant) {
        // Find latest employee code starting with EMP-
        let employeeCode = 'EMP-001';
        const latestEmployee = await tx.employeeProfile.findFirst({
          where: {
            employeeCode: {
              startsWith: 'EMP-',
            },
          },
          orderBy: {
            employeeCode: 'desc',
          },
          select: {
            employeeCode: true,
          },
        });

        if (latestEmployee && latestEmployee.employeeCode) {
          const parts = latestEmployee.employeeCode.split('-');
          const lastSeq = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(lastSeq)) {
            employeeCode = `EMP-${String(lastSeq + 1).padStart(3, '0')}`;
          }
        }

        employeeProfileData = {
          employeeCode,
          phone: createUserDto.phone || '',
          jobTitle: createUserDto.position || role.description || role.name,
          departmentId: createUserDto.departmentId || null,
          status: 'ACTIVE',
        };
      } else if (createUserDto.phone || createUserDto.position || createUserDto.departmentId) {
        employeeProfileData = {
          employeeCode: 'EMP-001',
          phone: createUserDto.phone || '',
          jobTitle: createUserDto.position || 'Directeur Général',
          departmentId: createUserDto.departmentId || null,
          status: 'ACTIVE',
        };
      }

      const user = await tx.user.create({
        data: {
          email: createUserDto.email,
          passwordHash,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          roleId: createUserDto.roleId,
          isActive: createUserDto.isActive !== undefined ? createUserDto.isActive : true,
          isArchived: false,
          avatarUrl: createUserDto.avatarUrl,
          ...(employeeProfileData && {
            employeeProfile: {
              create: employeeProfileData,
            },
          }),
        },
        include: {
          role: true,
          employeeProfile: true,
        },
      });

      // Initialize leave balances if employee profile was created
      if (user.employeeProfile) {
        const leaveTypes = [LeaveType.ANNUAL, LeaveType.SICK, LeaveType.UNPAID];
        const currentYear = new Date().getFullYear();
        for (const lt of leaveTypes) {
          await tx.leaveBalance.create({
            data: {
              employeeId: user.employeeProfile.id,
              leaveType: lt,
              year: currentYear,
              totalDays: lt === LeaveType.ANNUAL ? 26 : lt === LeaveType.SICK ? 10 : 5,
              usedDays: 0,
              pendingDays: 0,
            },
          });
        }
      }

      // Exclude passwordHash
      const { passwordHash: _, ...result } = user;
      return result;
    });
  }

  async findAll(query?: { showArchived?: boolean }) {
    const showArchived = query?.showArchived === true;
    const users = await this.prisma.user.findMany({
      where: { isArchived: showArchived },
      include: {
        role: true,
        employeeProfile: {
          include: {
            department: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Remove passwordHash
    return users.map((user) => {
      const { passwordHash: _, ...result } = user;
      return result;
    });
  }

  async findAllRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }

  async findAllDepartments() {
    return this.prisma.department.findMany();
  }

  async findOne(id: string, currentUser?: any) {
    if (currentUser && currentUser.role?.name === 'COLLABORATEUR' && id !== currentUser.id) {
      throw new ForbiddenException('Access denied: You can only access your own profile.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        employeeProfile: {
          include: {
            department: true
          }
        },
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!user || user.isArchived) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    const { passwordHash: _, ...result } = user;
    const permissions = user.role.permissions.map((rp) => rp.permission.name);

    return {
      ...result,
      permissions,
    };
  }

  async update(id: string, updateUserDto: UpdateUserDto, currentUser?: any) {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true, employeeProfile: true }
    });
    if (!user || user.isArchived) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    if (currentUser?.role?.name === 'COLLABORATEUR') {
      if (id !== currentUser.id) {
        throw new ForbiddenException('Access denied: You can only update your own profile.');
      }
      // Standard employees cannot modify their role or status
      delete updateUserDto.roleId;
      delete updateUserDto.isActive;
    }

    // Role-based protection: Secretary cannot edit/update CEO (GERANT) accounts
    if (currentUser?.role?.name === 'SECRETAIRE' && user.role.name === 'GERANT') {
      throw new ForbiddenException("Un secrétaire ne peut pas modifier la fiche d'un gérant (CEO).");
    }

    // Role-based protection: Secretary cannot assign the CEO (GERANT) role to any user
    const ceoRole = await this.prisma.role.findUnique({ where: { name: 'GERANT' } });
    if (currentUser?.role?.name === 'SECRETAIRE' && updateUserDto.roleId && ceoRole && updateUserDto.roleId === ceoRole.id) {
      throw new ForbiddenException('Un secrétaire ne peut pas attribuer le rôle de gérant.');
    }

    const data: any = {};
    if (updateUserDto.email !== undefined) data.email = updateUserDto.email;
    if (updateUserDto.firstName !== undefined) data.firstName = updateUserDto.firstName;
    if (updateUserDto.lastName !== undefined) data.lastName = updateUserDto.lastName;
    if (updateUserDto.roleId !== undefined) data.roleId = updateUserDto.roleId;
    if (updateUserDto.isActive !== undefined) data.isActive = updateUserDto.isActive;
    if (updateUserDto.avatarUrl !== undefined) data.avatarUrl = updateUserDto.avatarUrl;

    // Check if email conflicts
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      const emailConflict = await this.prisma.user.findUnique({
        where: { email: updateUserDto.email },
      });
      if (emailConflict) {
        throw new ConflictException('A user with this email address already exists.');
      }
    }

    // Hash password if modified
    if (updateUserDto.password) {
      data.passwordHash = await bcrypt.hash(updateUserDto.password, 10);
    }

    // Handle employee profile update
    if (updateUserDto.phone !== undefined || updateUserDto.position !== undefined || updateUserDto.departmentId !== undefined) {
      data.employeeProfile = {
        upsert: {
          create: {
            phone: updateUserDto.phone || '',
            jobTitle: updateUserDto.position || '',
            departmentId: updateUserDto.departmentId || null,
          },
          update: {
            ...(updateUserDto.phone !== undefined && { phone: updateUserDto.phone }),
            ...(updateUserDto.position !== undefined && { jobTitle: updateUserDto.position }),
            ...(updateUserDto.departmentId !== undefined && { departmentId: updateUserDto.departmentId || null }),
          }
        }
      };
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data,
      include: {
        role: true,
        employeeProfile: {
          include: {
            department: true
          }
        }
      },
    });

    const { passwordHash: _, ...result } = updated;
    return result;
  }

  async remove(id: string, currentUser?: any) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { role: true }
    });
    if (!user || user.isArchived) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    // Role-based protection: Secretary cannot delete/archive CEO (GERANT) accounts
    if (currentUser?.role?.name === 'SECRETAIRE' && user.role.name === 'GERANT') {
      throw new ForbiddenException('Un secrétaire ne peut pas archiver le compte d\'un gérant (CEO).');
    }

    // CEO account protection: Prevent deleting the last remaining CEO
    const ceoRole = await this.prisma.role.findUnique({ where: { name: 'GERANT' } });
    if (user.roleId === ceoRole?.id) {
      const ceoCount = await this.prisma.user.count({ where: { roleId: ceoRole.id, isArchived: false } });
      if (ceoCount <= 1) {
        throw new ConflictException('Cannot delete the last remaining CEO account.');
      }
    }

    await this.prisma.user.update({
      where: { id },
      data: { isArchived: true, isActive: false, deletedAt: new Date() },
    });

    return { success: true, message: 'User deleted successfully.' };
  }

  async restore(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found.`);
    }

    await this.prisma.user.update({
      where: { id },
      data: { isArchived: false, isActive: true, deletedAt: null },
    });

    return { success: true, message: 'User restored successfully.' };
  }
}
