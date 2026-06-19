import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { CreateReviewDto, ReviewQueryDto, UpdateReviewDto } from './dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller({ path: 'reviews', version: '1' })
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a review for a clinic or doctor (authenticated users)' })
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateReviewDto,
  ): Promise<ApiResponseDto<object>> {
    const review = await this.reviewsService.create(user.sub, dto);
    return ApiResponseDto.success(review, 'Review submitted');
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List reviews filtered by targetType and targetId' })
  @ApiQuery({ name: 'targetType', required: false, enum: ['CLINIC', 'ASSISTANT'] })
  @ApiQuery({ name: 'targetId', required: false, type: String })
  async findMany(@Query() query: ReviewQueryDto): Promise<ApiResponseDto<object>> {
    const data = await this.reviewsService.findMany(query);
    return ApiResponseDto.success(data);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update own review (owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateReviewDto,
  ): Promise<ApiResponseDto<object>> {
    const review = await this.reviewsService.update(id, dto, user.sub, user.role);
    return ApiResponseDto.success(review, 'Review updated');
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete own review (owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<null>> {
    await this.reviewsService.remove(id, user.sub, user.role);
    return ApiResponseDto.success(null, 'Review deleted');
  }

  // ─── Clinic Reply ──────────────────────────────────────────────────────────

  @Post(':id/reply')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Add clinic reply to a review (clinic owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async addReply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReplyReviewDto,
  ): Promise<ApiResponseDto<object>> {
    const review = await this.reviewsService.addReply(id, dto.reply, user.sub, user.role);
    return ApiResponseDto.success(review, 'Reply added');
  }

  @Delete(':id/reply')
  @ApiBearerAuth('access-token')
  @Roles(UserRole.CLINIC_OWNER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove clinic reply from a review (clinic owner or admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  async removeReply(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ApiResponseDto<object>> {
    const review = await this.reviewsService.removeReply(id, user.sub, user.role);
    return ApiResponseDto.success(review, 'Reply removed');
  }
}
