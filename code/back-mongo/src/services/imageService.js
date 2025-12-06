const { GridFSBucket, ObjectId } = require("mongodb");
const mongodb = require("../config/database-mongodb");

class ImageService {
  constructor() {
    this.bucket = null;
  }

  async getBucket() {
    if (!this.bucket) {
      const db = await mongodb.connect();
      this.bucket = new GridFSBucket(db, { bucketName: "images" });
    }
    return this.bucket;
  }

  async uploadProfileImage(userId, buffer, contentType) {
    const bucket = await this.getBucket();
    const filename = `profile-${userId}-${Date.now()}`;

    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(filename, {
        contentType,
        metadata: {
          userId: userId,
          uploadDate: new Date(),
          type: "profile",
        },
      });

      uploadStream.write(buffer);
      uploadStream.end(async (error) => {
        if (error) {
          console.error("Upload error:", error);
          reject(error);
          return;
        }

        try {
          const files = await bucket
            .find({ filename })
            .sort({ uploadDate: -1 })
            .limit(1)
            .toArray();
          if (files.length > 0) {
            resolve(files[0]._id);
          } else {
            console.error("No file found after upload");
            reject(new Error("Upload completed but no file found"));
          }
        } catch (findError) {
          console.error("Error finding file:", findError);
          reject(findError);
        }
      });
    });
  }

  async uploadChatImage(userId, buffer, contentType, originalName = null) {
    const bucket = await this.getBucket();
    const filename = `chat-${userId}-${Date.now()}-${originalName || "image"}`;

    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(filename, {
        contentType,
        metadata: {
          userId: userId,
          uploadDate: new Date(),
          type: "chat",
          originalName: originalName,
        },
      });

      uploadStream.write(buffer);
      uploadStream.end(async (error) => {
        if (error) {
          console.error("Chat image upload error:", error);
          reject(error);
          return;
        }

        try {
          const files = await bucket
            .find({ filename })
            .sort({ uploadDate: -1 })
            .limit(1)
            .toArray();
          if (files.length > 0) {
            resolve(files[0]._id);
          } else {
            console.error("No chat image file found after upload");
            reject(new Error("Upload completed but no file found"));
          }
        } catch (findError) {
          console.error("Error finding chat image file:", findError);
          reject(findError);
        }
      });
    });
  }

  async getChatImage(fileId) {
    const bucket = await this.getBucket();

    try {
      let objectId;
      if (typeof fileId === "string") {
        objectId = mongodb.getObjectId
          ? mongodb.getObjectId(fileId)
          : new ObjectId(fileId);
      } else {
        objectId = fileId;
      }

      const files = await bucket.find({ _id: objectId }).toArray();
      if (files.length === 0) {
        throw new Error("Chat image not found in GridFS");
      }

      const file = files[0];
      return {
        fileId: file._id,
        filename: file.filename,
        contentType: file.contentType,
        uploadDate: file.uploadDate,
        metadata: file.metadata,
        length: file.length,
      };
    } catch (error) {
      console.error("Error getting chat image:", error);
      throw new Error("Invalid chat image ID format or image not found");
    }
  }

  async deleteChatImage(fileId) {
    const bucket = await this.getBucket();

    try {
      let objectId;
      if (typeof fileId === "string") {
        objectId = mongodb.getObjectId
          ? mongodb.getObjectId(fileId)
          : new ObjectId(fileId);
      } else {
        objectId = fileId;
      }

      await bucket.delete(objectId);
      return true;
    } catch (error) {
      console.error("Error deleting chat image:", error);
      throw new Error("Failed to delete chat image");
    }
  }

  async getUserChatImages(userId, limit = 50) {
    const bucket = await this.getBucket();

    try {
      const files = await bucket
        .find({
          "metadata.userId": userId,
          "metadata.type": "chat",
        })
        .sort({ uploadDate: -1 })
        .limit(limit)
        .toArray();
      return files;
    } catch (error) {
      console.error("Error getting user chat images:", error);
      throw new Error("Failed to retrieve user chat images");
    }
  }

  async alternativeUpload(bucket, filename, buffer, contentType, userId) {
    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(filename, {
        contentType,
        metadata: {
          userId: userId,
          uploadDate: new Date(),
          type: "profile",
        },
      });

      uploadStream.end(buffer, async (error) => {
        if (error) {
          console.error("Alternative upload error:", error);
          reject(error);
          return;
        }

        try {
          const files = await bucket
            .find({ filename })
            .sort({ uploadDate: -1 })
            .limit(1)
            .toArray();
          if (files.length > 0 && files[0]._id) {
            resolve(files[0]._id);
          } else {
            console.error("Alternative upload: No file found after upload");
            reject(new Error("Upload completed but no file found"));
          }
        } catch (findError) {
          console.error("Error finding uploaded file:", findError);
          reject(new Error("Upload completed but could not verify file"));
        }
      });

      uploadStream.on("error", (error) => {
        console.error("Alternative upload stream error:", error);
        reject(error);
      });
    });
  }

  async uploadGroupProfileImage(
    userId,
    buffer,
    contentType,
    originalName = null
  ) {
    const bucket = await this.getBucket();
    const filename = `group-profile-${userId}-${Date.now()}-${
      originalName || "group-image"
    }`;

    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(filename, {
        contentType,
        metadata: {
          userId: userId,
          uploadDate: new Date(),
          type: "group_profile",
          originalName: originalName,
        },
      });

      uploadStream.write(buffer);
      uploadStream.end(async (error) => {
        if (error) {
          console.error("Group profile image upload error:", error);
          reject(error);
          return;
        }

        try {
          const files = await bucket
            .find({ filename })
            .sort({ uploadDate: -1 })
            .limit(1)
            .toArray();
          if (files.length > 0) {
            resolve(files[0]._id);
          } else {
            console.error("No group profile image file found after upload");
            reject(new Error("Upload completed but no file found"));
          }
        } catch (findError) {
          console.error("Error finding group profile image file:", findError);
          reject(findError);
        }
      });
    });
  }

  async getGroupProfileImage(groupId) {
    const bucket = await this.getBucket();

    try {
      const filesByGroup = await bucket
        .find({
          "metadata.groupId": groupId,
          "metadata.type": "group_profile",
        })
        .sort({ uploadDate: -1 })
        .limit(1)
        .toArray();

      if (filesByGroup.length > 0) {
        return filesByGroup[0];
      }

      const fallbackFiles = await bucket
        .find({
          filename: { $regex: `^group-profile-` },
          "metadata.type": "group_profile",
        })
        .sort({ uploadDate: -1 })
        .limit(10)
        .toArray();

      if (fallbackFiles.length > 0) {
        return fallbackFiles[0];
      }

      return null;
    } catch (error) {
      console.error("Error in getGroupProfileImage:", error);
      return null;
    }
  }

  async getGroupProfileImageById(fileId) {
    const bucket = await this.getBucket();

    try {
      let objectId;
      if (typeof fileId === "string") {
        objectId = mongodb.getObjectId
          ? mongodb.getObjectId(fileId)
          : new ObjectId(fileId);
      } else {
        objectId = fileId;
      }

      const files = await bucket.find({ _id: objectId }).toArray();
      if (files.length === 0) {
        throw new Error("Group profile image not found in GridFS");
      }

      const file = files[0];
      return {
        fileId: file._id,
        filename: file.filename,
        contentType: file.contentType,
        uploadDate: file.uploadDate,
        metadata: file.metadata,
        length: file.length,
      };
    } catch (error) {
      console.error("Error getting group profile image:", error);
      throw new Error("Invalid group image ID format or image not found");
    }
  }

  async getProfileImage(userId) {
    const bucket = await this.getBucket();

    try {
      const files = await bucket
        .find({
          "metadata.userId": userId,
          "metadata.type": "profile",
        })
        .sort({ uploadDate: -1 })
        .limit(1)
        .toArray();

      if (files.length > 0) {
        return files[0];
      }

      const fallbackFiles = await bucket
        .find({
          filename: { $regex: `^profile-${userId}` },
        })
        .sort({ uploadDate: -1 })
        .limit(1)
        .toArray();

      if (fallbackFiles.length > 0) {
        return fallbackFiles[0];
      }

      console.log(`No profile image found for user ${userId}`);
      return null;
    } catch (error) {
      console.error("Error in getProfileImage:", error);
      return null;
    }
  }

  async getImageStream(fileId) {
    const bucket = await this.getBucket();

    try {
      let objectId;
      if (typeof fileId === "string") {
        objectId = mongodb.getObjectId
          ? mongodb.getObjectId(fileId)
          : new ObjectId(fileId);
      } else {
        objectId = fileId;
      }

      const files = await bucket.find({ _id: objectId }).toArray();
      if (files.length === 0) {
        throw new Error("Image not found in GridFS");
      }

      return bucket.openDownloadStream(objectId);
    } catch (error) {
      console.error("Error getting image stream:", error);
      throw new Error("Invalid image ID format or image not found");
    }
  }

  async deleteProfileImage(userId) {
    const bucket = await this.getBucket();
    const files = await bucket
      .find({
        filename: `profile-${userId}`,
        "metadata.type": "profile",
      })
      .toArray();

    let deletedCount = 0;
    for (const file of files) {
      try {
        await bucket.delete(file._id);
        deletedCount++;
      } catch (error) {
        console.warn(`Could not delete file ${file._id}:`, error.message);
      }
    }
    return deletedCount;
  }
}

module.exports = new ImageService();
